import angular from "angular";
import type { Provider, TypeProvider } from "@/core/di/provider.ts";
import { ensureInject, ReflectInjection } from "@/core/di/reflect.ts";
import { assertNotServiceProvider } from "@/core/di/service.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import {
  buildComponentAsDirective,
  buildComponentOptions,
  buildDirectiveDefinition,
} from "@/core/metadata/directive-definition.ts";
import { getNgModuleDef, ngModuleInjectionName } from "@/core/metadata/ng-module.ts";
import { getPipeDef } from "@/core/metadata/pipe.ts";
import { parseSelector } from "@/core/metadata/selector-name.ts";
import { createPipeFilter } from "@/pipes/pipe-transform.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import { markNgModuleId, ngModuleScopes } from "@/runtime/ng-module-instances.ts";

const modules = new WeakMap<Function, angular.IModule>();

/**
 * Traduce una clase `@NgModule` a un `angular.module` real: resuelve `imports` a
 * nombres de módulo (deps), registra `providers` y `declarations`. Memoizado por
 * clase — llamarlo dos veces devuelve el mismo `angular.module` sin re-registrar.
 *
 * La clase del módulo se instancia en un `.run` (como Angular al crear el injector),
 * con DI de constructor — ver `NgModuleScope`. La config imperativa que un módulo
 * necesite (`.decorator()`, `.config()`) se hace por fuera, sobre el
 * `angular.IModule` que devuelve esta función (ver `core-module.ts`).
 */
export function registerNgModule(moduleType: Function, inheritedControllerAs?: string): angular.IModule {
  const existing = modules.get(moduleType);
  if (existing) return existing;

  const def = getNgModuleDef(moduleType);
  if (!def) throw new Error("registerNgModule: la clase no tiene @NgModule/ngModule().define()");

  // `controllerAs` del módulo, o el heredado del `@NgModule` que lo importa (gana el más cercano).
  const controllerAs = def.controllerAs ?? inheritedControllerAs;

  const deps = def.imports.map((imported) => resolveNgModuleImport(imported, controllerAs));
  const module = angular.module(def.id, deps);
  modules.set(moduleType, module);

  registerProviders(module, def.providers);
  for (const declaration of def.declarations) registerDeclaration(module, declaration, controllerAs);

  // Angular instancia cada clase `@NgModule` al crear su injector (imports primero —
  // AngularJS corre los `.run` de los `requires` antes que los propios).
  markNgModuleId(def.id, moduleType);
  module.run(instantiateNgModuleBlock(moduleType));
  // La instancia es inyectable (`inject(AppModule)`, nombre `ɵmod:<id>`), como en
  // Angular. Memoizado en el scope raíz: la misma que crea el `.run`. En una rama
  // lazy el loader saltea este `$provide` y publica la instancia de la rama en su entorno.
  module.factory(ngModuleInjectionName(def.id), [
    "$injector",
    ($injector: angular.auto.IInjectorService) => ngModuleScopes.root($injector).instantiate(moduleType, $injector),
  ]);

  return module;
}

/** Marca de los `.run` que instancian un `@NgModule` — el loader lazy los saltea e instancia en su scope. */
export const NG_MODULE_RUN_BLOCK = Symbol("ngjs-ng-module-run-block");

function instantiateNgModuleBlock(moduleType: Function) {
  const run = ($injector: angular.auto.IInjectorService) => {
    ngModuleScopes.root($injector).instantiate(moduleType, $injector);
  };
  run.$inject = ["$injector"];
  (run as unknown as Record<symbol, Function>)[NG_MODULE_RUN_BLOCK] = moduleType;
  return run;
}

export function getNgModuleName(moduleType: Function): string {
  return registerNgModule(moduleType).name;
}

function resolveNgModuleImport(imported: Function | angular.IModule | string, inheritedControllerAs?: string): string {
  if (typeof imported === "string") return imported;

  if (typeof imported === "function" && getNgModuleDef(imported)) {
    return registerNgModule(imported, inheritedControllerAs).name;
  }

  if (isAngularModule(imported)) {
    // `RouterModule.forRoot`/`forChild`: los componentes de ruta lazy no están en
    // ningún `@NgModule`, así que no heredan `controllerAs`. Guardamos el del
    // `@NgModule` que importa el router para que `lazyLoadFor` lo use de fallback.
    if (inheritedControllerAs && routerRegistry.hasModuleName(imported.name)) {
      routerRegistry.controllerAs = inheritedControllerAs;
    }
    return imported.name;
  }

  throw new Error("NgModule.imports solo acepta clases con @NgModule, angular.IModule o nombres de modulo");
}

function isAngularModule(value: unknown): value is angular.IModule {
  return typeof value === "object" && value !== null && typeof (value as angular.IModule).name === "string";
}

function registerDeclaration(module: angular.IModule, declaration: Function, moduleControllerAs?: string): void {
  const componentDef = getComponentDef(declaration);
  if (componentDef) {
    ensureInject(declaration);
    const parsed = parseSelector(componentDef.selector);
    if (parsed.restrict === "A") {
      // Selector de atributo/compuesto (`[ngbNavOutlet]`, `button[ngbNavLink]`):
      // `.component()` SIEMPRE registra como elemento — no hay forma de pedirle
      // otra cosa. Se arma a mano el `.directive()` equivalente (mismo desugar
      // que `.component()` hace internamente) con el `restrict` correcto.
      module.directive(parsed.registrationName, () =>
        buildComponentAsDirective(declaration, componentDef, moduleControllerAs),
      );
      return;
    }
    module.component(parsed.registrationName, buildComponentOptions(declaration, componentDef, moduleControllerAs));
    return;
  }

  const directiveDef = getDirectiveDef(declaration);
  if (directiveDef) {
    ensureInject(declaration);
    const factory = (declaration as { $factory?: () => angular.IDirective }).$factory;
    const parsed = parseSelector(directiveDef.selector);
    module.directive(
      parsed.registrationName,
      factory ?? (() => buildDirectiveDefinition(declaration, directiveDef, moduleControllerAs)),
    );
    return;
  }

  const pipeDef = getPipeDef(declaration);
  if (pipeDef) {
    module.filter(pipeDef.name, createPipeFilter(declaration));
    return;
  }

  throw new Error(
    `NgModule.declarations: "${declaration.name}" no tiene @Component/@Directive/@Pipe (ni ngX().define()).`,
  );
}

type SingleProvider = Exclude<Provider, Provider[]>;

function isTypeProvider(provider: SingleProvider): provider is TypeProvider {
  return typeof provider === "function";
}

function registerProviders(module: angular.IModule, providers: Provider[]): void {
  const flat = (providers as unknown[]).flat(Infinity) as SingleProvider[];
  const single = new Map<string, SingleProvider>();
  const multi = new Map<string, SingleProvider[]>();

  for (const provider of flat) {
    const token = isTypeProvider(provider) ? provider : provider.provide;
    const name = ReflectInjection.translate(token);

    if (!isTypeProvider(provider) && provider.multi) multi.set(name, [...(multi.get(name) ?? []), provider]);
    else single.set(name, provider);
  }

  for (const [name, provider] of single) registerSingle(module, name, provider);

  for (const [name, group] of multi) {
    const memberNames = group.map((provider, i) => {
      const memberName = `${name}#multi#${i}`;
      registerSingle(module, memberName, provider);
      return memberName;
    });

    module.factory(name, [
      "$injector",
      ($injector: angular.auto.IInjectorService) => memberNames.map((memberName) => $injector.get(memberName)),
    ]);
  }
}

function registerSingle(module: angular.IModule, name: string, provider: SingleProvider): void {
  if (isTypeProvider(provider)) {
    assertNotServiceProvider(provider);
    ensureInject(provider);
    module.service(name, provider as unknown as Function);
    return;
  }

  if ("useValue" in provider) {
    module.constant(name, provider.useValue);
    return;
  }

  if ("useClass" in provider) {
    assertNotServiceProvider(provider.useClass);
    ensureInject(provider.useClass);
    module.service(name, provider.useClass as unknown as Function);
    return;
  }

  if ("useFactory" in provider) {
    const deps = (provider.deps ?? []).map(ReflectInjection.translate);
    module.factory(name, [...deps, provider.useFactory] as unknown as angular.Injectable<Function>);
    return;
  }

  if ("useExisting" in provider) {
    const existingName = ReflectInjection.translate(provider.useExisting);
    module.factory(name, ["$injector", ($injector: angular.auto.IInjectorService) => $injector.get(existingName)]);
    return;
  }

  assertNotServiceProvider(provider.provide as unknown as Function);
  const ctor = provider.provide as unknown as { $inject: string[] };
  ctor.$inject = (provider.deps ?? []).map(ReflectInjection.translate);
  module.service(name, provider.provide as unknown as Function);
}
