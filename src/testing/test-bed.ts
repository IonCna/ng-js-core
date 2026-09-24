import angular from "angular";
import type { InjectOptions } from "@/core/di/inject.ts";
import { runInInjectionContext } from "@/core/di/injection-context.ts";
import { injectionTokenName } from "@/core/di/injector.ts";
import type { Provider } from "@/core/di/provider.ts";
import type { ProviderToken, Type } from "@/core/di/provider-token.ts";
import { RuntimeProviders } from "@/core/di/runtime-providers.ts";
import { CompiledType } from "@/core/metadata/compiled-type.ts";
import { ApplicationRef } from "@/core/platform/application-ref.ts";
import type { PlatformRef } from "@/core/platform/bootstrap.ts";
import type { ComponentRef } from "@/core/refs/component-ref.ts";
import { createComponent } from "@/core/refs/create-component.ts";
import { NativeModule } from "@/native/native.module.ts";
import { ComponentFixture } from "@/testing/component-fixture.ts";
import { TestingDeclarations } from "@/testing/testing-declarations.ts";

type ModuleImport = Function | angular.IModule | string;

export interface ModuleTeardownOptions {
  /** Destruir los fixtures (y sacarlos del DOM) al resetear el módulo de test. Por defecto `true`, como Angular. */
  destroyAfterEach: boolean;
}

export interface TestEnvironmentOptions {
  teardown?: ModuleTeardownOptions;
}

export interface TestModuleMetadata {
  /** `@NgModule` compilados, `angular.IModule` o nombres de módulos de AngularJS. */
  imports?: ModuleImport[];
  /** `@Component`/`@Directive`/`@Pipe` compilados que no están en ningún módulo importado. */
  declarations?: Function[];
  providers?: Provider[];
  teardown?: ModuleTeardownOptions;
}

/**
 * `MetadataOverride<Component>` de Angular. Solo `set.template`: el template ya es HTML de AngularJS, así que
 * cambiarlo en runtime no necesita compilar nada; el resto de la metadata la tradujo `ng-js-compiler` en build.
 */
export interface MetadataOverride<T> {
  set?: Partial<T>;
  add?: Partial<T>;
  remove?: Partial<T>;
}

/** El provider de `overrideProvider()`: sin `provide`, lo pone `TestBed`. */
type ProviderOverride =
  | { useValue: unknown; multi?: boolean }
  | { useFactory: Function; deps: unknown[]; multi?: boolean }
  | { useFactory?: Function; useValue?: unknown; deps?: unknown[]; multi?: boolean };

/**
 * Los `providedIn: "root"` compilados que ya se evaluaron (la cola de `globalThis.ɵngjsRootProviders`, que en una
 * app arma la plataforma al arrancar): en un test no hay plataforma.
 */
class RootProviders {
  static module(name: string): string {
    const queue = ((globalThis as Record<string, unknown>).ɵngjsRootProviders ?? []) as [string, unknown][];
    const module = angular.module(`${name}.root`, []);
    for (const [token, factory] of queue) module.factory(token, factory as never);
    return module.name;
  }
}

/**
 * Lo que la plataforma deja en `globalThis` al arrancar y `TestBed` deja mientras vive su injector:
 * `ɵngjsInjector` (el `inject()` de runtime) y `ɵngjsRootScope` (el `$apply` de los parches de zona que emite el
 * compilador, si están cargados). Se devuelven los anteriores al resetear.
 */
class GlobalInjector {
  private static readonly KEYS = ["ɵngjsInjector", "ɵngjsRootScope"] as const;
  private previous: unknown[] = [];

  set(injector: angular.auto.IInjectorService): void {
    const globals = globalThis as Record<string, unknown>;
    const values = [injector, injector.get("$rootScope")];
    this.previous = GlobalInjector.KEYS.map((key) => globals[key]);
    GlobalInjector.KEYS.forEach((key, index) => {
      globals[key] = values[index];
    });
  }

  restore(): void {
    const globals = globalThis as Record<string, unknown>;
    GlobalInjector.KEYS.forEach((key, index) => {
      globals[key] = this.previous[index];
    });
    this.previous = [];
  }
}

/**
 * El `TestBed` de `@angular/core/testing` sobre AngularJS. Cada test configura un `angular.module` propio (los
 * bridges de `NativeModule`, los `providedIn: "root"`, el entorno, los imports, las declaraciones y los providers
 * — los del test ganan: se registran último) y la primera vez que se pide algo (`inject`, `createComponent`) se
 * crea su injector con `angular.injector()`, sin `angular.mock`. `resetTestingModule()` lo descarta; si el test
 * framework expone `afterEach` global, se llama solo después de cada test.
 */
export class TestBedImpl {
  private static moduleCount = 0;

  private environment: ModuleImport[] | undefined;
  private _platform: PlatformRef | undefined;
  private environmentTeardown: ModuleTeardownOptions | undefined;

  private imports: ModuleImport[] = [];
  private declarations: Function[] = [];
  private providers: Provider[] = [];
  private overrides: Provider[] = [];
  /** `overrideComponent()`: componente → template nuevo. */
  private templates = new Map<Function, string>();
  private teardown: ModuleTeardownOptions | undefined;

  private $injector: angular.auto.IInjectorService | undefined;
  private root: HTMLElement | undefined;
  private fixtures: ComponentFixture<unknown>[] = [];
  private rootCount = 0;
  private readonly globalInjector = new GlobalInjector();

  get platform(): PlatformRef | undefined {
    return this._platform;
  }

  get ngModule(): ModuleImport | ModuleImport[] | undefined {
    return this.environment;
  }

  /** Módulos que se importan en cada módulo de test (los de `@angular/platform-browser-dynamic/testing`). */
  initTestEnvironment(
    ngModule: ModuleImport | ModuleImport[],
    platform: PlatformRef,
    options?: TestEnvironmentOptions,
  ): void {
    if (this.environment) throw new Error("TestBed: initTestEnvironment() ya se llamó (falta resetTestEnvironment()).");
    this.environment = Array.isArray(ngModule) ? ngModule : [ngModule];
    this._platform = platform;
    this.environmentTeardown = options?.teardown;
  }

  resetTestEnvironment(): void {
    this.resetTestingModule();
    this.environment = undefined;
    this._platform = undefined;
    this.environmentTeardown = undefined;
  }

  configureTestingModule(moduleDef: TestModuleMetadata): this {
    this.assertNotInstantiated("configureTestingModule");
    this.imports.push(...(moduleDef.imports ?? []));
    this.declarations.push(...(moduleDef.declarations ?? []));
    this.providers.push(...(moduleDef.providers ?? []));
    if (moduleDef.teardown) this.teardown = moduleDef.teardown;
    return this;
  }

  /** No hay nada que compilar en runtime (lo hizo `ng-js-compiler`): resuelve enseguida. */
  compileComponents(): Promise<void> {
    return Promise.resolve();
  }

  overrideProvider(token: unknown, provider: ProviderOverride): this {
    this.assertNotInstantiated("overrideProvider");
    this.overrides.push({ provide: token, ...provider } as Provider);
    return this;
  }

  /** Solo `{ set: { template } }` (ver `MetadataOverride`). */
  overrideComponent(component: Type<unknown>, override: MetadataOverride<{ template: string }>): this {
    this.assertNotInstantiated("overrideComponent");
    const { template, ...rest } = override.set ?? {};
    if (override.add || override.remove || Object.keys(rest).length || template === undefined) {
      throw new Error(`TestBed.overrideComponent("${component.name}"): solo se soporta { set: { template } }.`);
    }
    if (!CompiledType.isComponent(component))
      throw new Error(`TestBed.overrideComponent: "${component.name}" no es un @Component compilado.`);
    this.templates.set(component, template);
    return this;
  }

  overrideTemplate(component: Type<unknown>, template: string): this {
    return this.overrideComponent(component, { set: { template } });
  }

  inject<T>(token: ProviderToken<T> | string, notFoundValue?: T, options?: InjectOptions): T;
  inject<T>(token: ProviderToken<T> | string, notFoundValue: null | undefined, options: InjectOptions): T | null;
  inject<T>(token: ProviderToken<T> | string, notFoundValue?: T | null, options?: InjectOptions): T | null {
    const $injector = this.injector;
    const name = injectionTokenName(token);
    if (!$injector.has(name)) {
      if (notFoundValue !== undefined) return notFoundValue;
      if (options?.optional) return null;
    }
    return $injector.get<T>(name);
  }

  /** Corre `fn` con el injector del módulo de test como contexto de `inject()`. */
  runInInjectionContext<T>(fn: () => T): T {
    return runInInjectionContext(
      { get: (token, options) => this.inject(token as ProviderToken<unknown>, undefined, options ?? {}) },
      fn,
    );
  }

  /**
   * Crea el componente en un `<div id="rootN">` del documento. Tiene que estar listo al enlazar: un `templateUrl`
   * tiene que estar en `$templateCache`.
   */
  createComponent<T>(component: Type<T>): ComponentFixture<T> {
    const $injector = this.injector;
    const rootElement = document.createElement("div");
    rootElement.id = `root${this.rootCount++}`;
    this.root!.appendChild(rootElement);

    let ref: ComponentRef<T> | undefined;
    let failure: unknown;
    createComponent<T>(component, { injector: $injector, hostElement: rootElement }).then(
      (created) => {
        ref = created;
      },
      (error: unknown) => {
        failure = error;
      },
    );
    // `createComponent` resuelve con `$q`: el digest lo entrega (la vista del componente sigue suspendida).
    const $rootScope = $injector.get<angular.IRootScopeService>("$rootScope");
    if (!$rootScope.$$phase) $rootScope.$digest();

    if (!ref) {
      rootElement.remove();
      throw (
        failure ??
        new Error(`TestBed.createComponent: "${component.name}" no terminó de crearse (¿templateUrl fuera de $templateCache?).`)
      );
    }
    const fixture = new ComponentFixture<T>(ref, $injector, rootElement);
    this.fixtures.push(fixture as ComponentFixture<unknown>);
    return fixture;
  }

  resetTestingModule(): this {
    const destroyFixtures = (this.teardown ?? this.environmentTeardown)?.destroyAfterEach ?? true;
    const fixtures = this.fixtures;
    this.fixtures = [];
    this.imports = [];
    this.declarations = [];
    this.providers = [];
    this.overrides = [];
    this.templates = new Map();
    this.teardown = undefined;
    this.rootCount = 0;

    const $injector = this.$injector;
    const root = this.root;
    this.$injector = undefined;
    this.root = undefined;
    if (!$injector) return this;

    let firstError: unknown;
    const attempt = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        firstError ??= error;
      }
    };
    if (destroyFixtures) {
      for (const fixture of fixtures) attempt(() => fixture.destroy());
      root?.remove();
    }
    attempt(() => $injector.get<ApplicationRef>(injectionTokenName(ApplicationRef)).destroy());
    this.globalInjector.restore();
    if (firstError) throw firstError;
    return this;
  }

  /** El injector del módulo de test: se crea la primera vez que se pide. */
  private get injector(): angular.auto.IInjectorService {
    this.$injector ??= this.instantiate();
    return this.$injector;
  }

  private instantiate(): angular.auto.IInjectorService {
    TestBedImpl.moduleCount += 1;
    const name = `ngjs.testing.${TestBedImpl.moduleCount}`;
    const module = angular.module(name, [
      RootProviders.module(name),
      NativeModule.name,
      ...[...(this.environment ?? []), ...this.imports].map(TestingDeclarations.moduleName),
    ]);
    for (const type of this.declarations) TestingDeclarations.register(module, type);

    const root = document.createElement("div");
    root.setAttribute("ngjs-test-root", "");
    document.body.appendChild(root);
    const providers = [...this.providers, ...this.overrides];
    module.config([
      "$provide",
      ($provide: angular.auto.IProvideService) => {
        $provide.value("$rootElement", angular.element(root));
        RuntimeProviders.register($provide, providers);
      },
    ]);
    TemplateOverrides.register(module, this.templates);

    let $injector: angular.auto.IInjectorService;
    try {
      $injector = angular.injector(["ng", name]);
    } catch (error) {
      root.remove();
      throw error;
    }
    // Como `angular.bootstrap`: `angular.element(nodo).injector()` desde un fixture llega a este injector.
    angular.element(root).data("$injector", $injector);
    this.root = root;
    this.globalInjector.set($injector);
    return $injector;
  }

  private assertNotInstantiated(method: string): void {
    if (this.$injector)
      throw new Error(`TestBed.${method}(): el módulo de test ya se instanció (se llamó inject/createComponent antes).`);
  }
}

/**
 * Los `overrideComponent()` en la fase de config del módulo de test (ya se registró todo lo importado y declarado):
 * un componente registrado recibe el template nuevo por `decorator` de su directiva; uno que no está en ningún
 * módulo (el `TestComponent` de un spec) se registra acá con él — `createComponent` lo encuentra ya registrado.
 */
class TemplateOverrides {
  static register(module: angular.IModule, templates: Map<Function, string>): void {
    if (!templates.size) return;
    module.config([
      "$injector",
      "$provide",
      "$compileProvider",
      (
        $injector: angular.auto.IInjectorService,
        $provide: angular.auto.IProvideService,
        $compileProvider: angular.ICompileProvider,
      ) => {
        for (const [type, template] of templates) {
          const name = CompiledType.camelCase(CompiledType.componentTag(type)!);
          // `<ng-content>` → `transclude`, lo que el compilador decide con el template original.
          const transclude = /<ng-content[s>/]/.test(template);
          if ($injector.has(`${name}DirectiveProvider`)) {
            $provide.decorator(`${name}Directive`, [
              "$delegate",
              ($delegate: angular.IDirective[]) => {
                const [directive] = $delegate;
                directive!.template = template;
                directive!.templateUrl = undefined;
                directive!.transclude = transclude;
                return $delegate;
              },
            ]);
          } else {
            const definition = CompiledType.def(type)?.definition ?? {};
            $compileProvider.component(name, {
              controller: (type as { ɵfac?: unknown }).ɵfac,
              ...definition,
              template,
              templateUrl: undefined,
              transclude,
            } as angular.IComponentOptions);
          }
        }
      },
    ]);
  }
}

/**
 * `inject([A, B], (a, b) => …)` de `@angular/core/testing`: una función que corre `fn` con los tokens resueltos
 * por `TestBed.inject` — para `beforeEach(inject([...], fn))`.
 */
export function inject(tokens: unknown[], fn: Function): () => unknown {
  return function (this: unknown) {
    return fn.apply(
      this,
      tokens.map((token) => TestBed.inject(token as ProviderToken<unknown>)),
    );
  };
}

/** `TestBed` de `@angular/core/testing`: la instancia única. */
export const TestBed: TestBedImpl = new TestBedImpl();
export type TestBed = TestBedImpl;

export function getTestBed(): TestBedImpl {
  return TestBed;
}

// Como Angular: si el test framework expone `afterEach` global (Jasmine, Jest, Vitest con `globals`), resetea solo.
(globalThis as { afterEach?: (fn: () => void) => void }).afterEach?.(() => TestBed.resetTestingModule());
