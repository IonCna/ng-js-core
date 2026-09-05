import angular from "angular";
import type { Provider, TypeProvider } from "@/core/di/provider.ts";
import { ensureInject, ReflectInjection } from "@/core/di/reflect.ts";
import { bindingsFromDefs } from "@/core/metadata/component-bindings.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { getNgModuleDef } from "@/core/metadata/ng-module.ts";
import { getPipeDef } from "@/core/metadata/pipe.ts";
import { createPipeFilter } from "@/pipes/pipe-transform.ts";

const modules = new WeakMap<Function, angular.IModule>();

/**
 * Traduce una clase `@NgModule` a un `angular.module` real: resuelve `imports` a
 * nombres de módulo (deps), registra `providers` y `declarations`. Memoizado por
 * clase — llamarlo dos veces devuelve el mismo `angular.module` sin re-registrar.
 *
 * No instancia la clase del módulo ni le pasa nada al constructor: un `@NgModule`
 * es solo metadata declarativa, igual que en Angular. La config imperativa que un
 * módulo necesite (`.decorator()`, `.config()`, `.run()`) se hace por fuera, sobre
 * el `angular.IModule` que devuelve esta función (ver `core-module.ts`).
 */
export function registerNgModule(moduleType: Function): angular.IModule {
  const existing = modules.get(moduleType);
  if (existing) return existing;

  const def = getNgModuleDef(moduleType);
  if (!def) throw new Error("registerNgModule: la clase no tiene @NgModule/ngModule().define()");

  const deps = def.imports.map(resolveNgModuleImport);
  const module = angular.module(def.id, deps);
  modules.set(moduleType, module);

  registerProviders(module, def.providers);
  for (const declaration of def.declarations) registerDeclaration(module, declaration);

  return module;
}

export function getNgModuleName(moduleType: Function): string {
  return registerNgModule(moduleType).name;
}

function resolveNgModuleImport(imported: Function | angular.IModule | string): string {
  if (typeof imported === "string") return imported;

  if (typeof imported === "function" && getNgModuleDef(imported)) {
    return registerNgModule(imported).name;
  }

  if (isAngularModule(imported)) return imported.name;

  throw new Error("NgModule.imports solo acepta clases con @NgModule, angular.IModule o nombres de modulo");
}

function isAngularModule(value: unknown): value is angular.IModule {
  return typeof value === "object" && value !== null && typeof (value as angular.IModule).name === "string";
}

function registerDeclaration(module: angular.IModule, declaration: Function): void {
  const componentDef = getComponentDef(declaration);
  if (componentDef) {
    ensureInject(declaration);
    module.component(toCamelCase(componentDef.selector), {
      controller: declaration as unknown as angular.Injectable<angular.IControllerConstructor>,
      template: componentDef.template,
      templateUrl: componentDef.templateUrl,
      controllerAs: componentDef.controllerAs,
      require: componentDef.require,
      bindings: computeComponentBindings(componentDef),
      transclude: componentDef.transclude ?? (componentDef.template?.includes("<ng-content") ? true : undefined),
    });
    return;
  }

  const directiveDef = getDirectiveDef(declaration);
  if (directiveDef) {
    ensureInject(declaration);
    const factory = (declaration as { $factory?: () => angular.IDirective }).$factory;
    module.directive(
      toCamelCase(stripAttributeSelector(directiveDef.selector)),
      factory ?? (() => createDirectiveDefinition(declaration, directiveDef)),
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

type StampedDirectiveDef = NonNullable<ReturnType<typeof getDirectiveDef>>;

function createDirectiveDefinition(declaration: Function, def: StampedDirectiveDef): angular.IDirective {
  return {
    controller: declaration as unknown as angular.Injectable<angular.IControllerConstructor>,
    bindToController: def.bindToController ?? true,
    restrict: def.restrict ?? inferRestrict(def.selector),
    scope: def.scope,
    require: def.require,
    transclude: def.transclude,
    template: def.template,
    templateUrl: def.templateUrl,
    controllerAs: def.controllerAs,
    priority: def.priority,
    terminal: def.terminal,
    compile: def.compile,
    link: def.link,
  };
}

type StampedComponentDef = NonNullable<ReturnType<typeof getComponentDef>>;

function computeComponentBindings(def: StampedComponentDef): Record<string, string> {
  return def.bindings ?? bindingsFromDefs(def.inputs, def.outputs);
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
    ensureInject(provider);
    module.service(name, provider as unknown as Function);
    return;
  }

  if ("useValue" in provider) {
    module.constant(name, provider.useValue);
    return;
  }

  if ("useClass" in provider) {
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

  const ctor = provider.provide as unknown as { $inject: string[] };
  ctor.$inject = (provider.deps ?? []).map(ReflectInjection.translate);
  module.service(name, provider.provide as unknown as Function);
}

function stripAttributeSelector(selector: string): string {
  return selector.startsWith("[") && selector.endsWith("]") ? selector.slice(1, -1) : selector;
}

function inferRestrict(selector: string): string {
  return selector.startsWith("[") ? "A" : "E";
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}
