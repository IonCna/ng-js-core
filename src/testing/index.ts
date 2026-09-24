/**
 * `ngjs-core/testing` — arranque de tests estilo `TestBed` sobre `angular.mock`, con clases compiladas por
 * `ng-js-compiler`: `angular.mock.module(configureTestingModule({ imports: [FeatureModule], declarations, providers }))`.
 */
import angular from "angular";
import type { Provider } from "@/core/di/provider.ts";
import { RuntimeProviders } from "@/core/di/runtime-providers.ts";
import { CompiledType } from "@/core/metadata/compiled-type.ts";
import { NativeModule } from "@/native/native.module.ts";

export interface TestingModuleConfig {
  /** `@NgModule` compilados, `angular.IModule` o nombres de módulos de AngularJS. */
  imports?: (Function | angular.IModule | string)[];
  /** `@Component`/`@Directive`/`@Pipe` compilados que no están en ningún módulo importado. */
  declarations?: Function[];
  providers?: Provider[];
}

/** Contador de nombres únicos para cada módulo de test. */
class TestingModuleNames {
  private n = 0;
  next(): string {
    this.n += 1;
    return `ngjs.testing.${this.n}`;
  }
}

const names = new TestingModuleNames();

/** Registra en un `angular.module` una declaración compilada, con lo mismo que emitiría el compilador. */
class TestingDeclarations {
  static register(module: angular.IModule, type: Function): void {
    const pipe = (type as { ɵpipe?: { name: string; pure: boolean } }).ɵpipe;
    const factory = (type as { ɵfac?: unknown[] }).ɵfac;
    if (pipe && factory) {
      TestingDeclarations.pipe(module, pipe, factory);
      return;
    }

    const def = CompiledType.def(type);
    if (!def || !factory)
      throw new Error(`configureTestingModule: "${type.name}" no es un @Component/@Directive/@Pipe compilado.`);
    const definition = def.definition ?? {};

    if (CompiledType.isComponent(type)) {
      const tag = CompiledType.componentTag(type);
      if (!tag) throw new Error(`configureTestingModule: "${type.name}" necesita un selector de elemento.`);
      module.component(CompiledType.camelCase(tag), {
        controller: factory,
        ...definition,
      } as angular.IComponentOptions);
      return;
    }

    for (const [tag, attribute] of def.selectors) {
      const name = CompiledType.camelCase(attribute || tag || "");
      const { bindings, ...rest } = definition as { bindings?: Record<string, string> };
      module.directive(name, () => ({
        controller: factory as never,
        restrict: attribute ? "A" : "E",
        bindToController: bindings ?? true,
        controllerAs: name,
        ...rest,
      }));
    }
  }

  private static pipe(module: angular.IModule, pipe: { name: string; pure: boolean }, factory: unknown[]): void {
    module.filter(pipe.name, [
      "$injector",
      ($injector: angular.auto.IInjectorService) => {
        const instance = $injector.invoke<{ transform(...args: unknown[]): unknown }>(factory as never);
        const filter = (...args: unknown[]) => instance.transform(...args);
        if (!pipe.pure) (filter as { $stateful?: boolean }).$stateful = true;
        return filter;
      },
    ]);
  }

  static moduleName(imported: Function | angular.IModule | string): string {
    if (typeof imported === "string") return imported;
    const id = (imported as { ɵmod?: { id: string } }).ɵmod?.id;
    return id ?? (imported as angular.IModule).name;
  }
}

/**
 * Los `providedIn: "root"` compilados que ya se evaluaron (la cola de `globalThis.ɵngjsRootProviders`, que en una
 * app arma la plataforma al arrancar) — en un test con `angular.mock` no hay plataforma.
 */
class RootProviders {
  static module(name: string): string {
    const queue = ((globalThis as Record<string, unknown>).ɵngjsRootProviders ?? []) as [string, unknown][];
    const module = angular.module(`${name}.root`, []);
    for (const [token, factory] of queue) module.factory(token, factory as never);
    return module.name;
  }
}

/** Nada que limpiar: cada `configureTestingModule` arma su propio módulo y cada `angular.mock` su propio injector. */
export function resetTestingModule(): void {}

/**
 * Arma un módulo de test con los bridges de `ngjs-core` (`NativeModule`), los `providedIn: "root"`, lo que se
 * importe, las declaraciones y los `providers` (los del test ganan: se registran último) y devuelve su nombre para
 * `angular.mock.module`.
 */
export function configureTestingModule(config: TestingModuleConfig = {}): string {
  const name = names.next();
  const requires = [
    RootProviders.module(name),
    NativeModule.name,
    ...(config.imports ?? []).map(TestingDeclarations.moduleName),
  ];
  const module = angular.module(name, requires);
  for (const type of config.declarations ?? []) TestingDeclarations.register(module, type);
  if (config.providers?.length) {
    const providers = config.providers;
    module.config([
      "$provide",
      ($provide: angular.auto.IProvideService) => RuntimeProviders.register($provide, providers),
    ]);
  }
  return name;
}
