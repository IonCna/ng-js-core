import type angular from "angular";
import { applyConstructorInject } from "@/core/di/ctor-inject.ts";
import { getInjectFlags } from "@/core/di/inject-flags.ts";
import type { Provider } from "@/core/di/provider.ts";
import { getNgModuleDef, NG_MODULE_TOKEN_PREFIX } from "@/core/metadata/ng-module.ts";
import { ApplicationRef } from "@/core/platform/application-ref.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import { ElementInjectorNode } from "@/runtime/element-injector-node.ts";

const NOT_FOUND = Symbol("ngjs-module-not-found");

/**
 * Instancias de clases `@NgModule` de un "injector de módulo" (Angular: el
 * `R3Injector` de la app o el `EnvironmentInjector` de una rama lazy). La raíz es
 * la app; cada `loadChildren` → `@NgModule` crea un scope hijo del scope de la
 * rama lazy ancestro más cercana (o de la raíz).
 *
 * `environment`: en una rama lazy, el nodo con los `providers` de sus `@NgModule`
 * (el `EnvironmentInjector` de Angular). La raíz no tiene — ahí manda el `$injector`.
 */
export class NgModuleScope {
  private readonly instances = new Map<string, unknown>();

  constructor(
    readonly parent?: NgModuleScope,
    readonly environment?: ElementInjectorNode,
  ) {}

  has(id: string): boolean {
    return this.instances.has(id);
  }

  /**
   * Como `R3Injector.destroy()` de Angular: `ngOnDestroy` de los servicios del
   * entorno y de las instancias de `@NgModule` de este scope.
   */
  destroy(): void {
    this.environment?.destroy();
    for (const instance of [...this.instances.values()].reverse()) {
      (instance as { ngOnDestroy?: () => void } | null)?.ngOnDestroy?.();
    }
    this.instances.clear();
  }

  /** Busca la instancia del módulo `id` en este scope y hacia arriba. `skipSelf` arranca en el padre. */
  lookup(id: string, flags: { self?: boolean; skipSelf?: boolean }): unknown {
    let scope: NgModuleScope | undefined = flags.skipSelf ? this.parent : this;
    while (scope) {
      if (scope.instances.has(id)) return scope.instances.get(id);
      if (flags.self) break;
      scope = scope.parent;
    }
    return NOT_FOUND;
  }

  /**
   * `new moduleType(...deps)` en este scope (una vez por scope). Un parámetro cuyo
   * token es otra clase `@NgModule` se resuelve contra las instancias de módulo
   * (`@Optional()`/`@SkipSelf()`/`@Self()` incluidos — el guard de "CoreModule
   * importado dos veces"); el resto sale del entorno de la rama (o del `$injector`).
   */
  instantiate(moduleType: Function, $injector: angular.auto.IInjectorService): unknown {
    const def = getNgModuleDef(moduleType);
    if (!def) throw new Error(`NgModuleScope: "${moduleType.name}" no es un @NgModule.`);
    if (this.instances.has(def.id)) return this.instances.get(def.id);

    applyConstructorInject(moduleType);
    const names = (moduleType as { $inject?: readonly string[] }).$inject ?? [];
    const args = names.map((name, index) => this.resolveParam(moduleType, name, index, $injector));
    const instance = new (moduleType as new (...a: unknown[]) => unknown)(...args);
    this.instances.set(def.id, instance);
    return instance;
  }

  private resolveParam(
    moduleType: Function,
    name: string,
    index: number,
    $injector: angular.auto.IInjectorService,
  ): unknown {
    const flags = getInjectFlags(moduleType, index);

    const moduleId = name.startsWith(NG_MODULE_TOKEN_PREFIX) ? name.slice(NG_MODULE_TOKEN_PREFIX.length) : undefined;
    if (moduleId !== undefined && ngModuleIds.has(moduleId)) {
      const found = this.lookup(moduleId, flags);
      if (found !== NOT_FOUND) return found;
      if (flags.optional) return null;
      throw new Error(`${moduleType.name}: no hay instancia del @NgModule "${moduleId}" (NullInjectorError).`);
    }

    if (this.environment) return this.environment.get(name, flags);
    if (flags.optional && !$injector.has(name)) return null;
    return $injector.get(name);
  }
}

/** Id de `angular.module` → clase `@NgModule` registrada. */
const ngModuleIds = new Map<string, Function>();

export function markNgModuleId(id: string, moduleType: Function): void {
  ngModuleIds.set(id, moduleType);
}

export function ngModuleTypeOf(id: string): Function | undefined {
  return ngModuleIds.get(id);
}

/**
 * Scopes de módulo por app (`$injector`): la raíz y uno por estado lazy
 * (`loadChildren` → `@NgModule`), indexados por state name. También los entornos
 * de `Route.providers` (Angular: `route._injector`), creados al primer uso.
 */
class NgModuleScopes {
  private readonly roots = new WeakMap<object, NgModuleScope>();
  private readonly byState = new WeakMap<object, Map<string, NgModuleScope>>();
  private readonly routeEnvironments = new WeakMap<object, Map<string, ElementInjectorNode>>();
  /** Clase declarada en un `@NgModule` lazy → entorno de su rama. */
  private readonly environmentByClass = new WeakMap<object, WeakMap<Function, ElementInjectorNode>>();

  root($injector: object): NgModuleScope {
    let root = this.roots.get($injector);
    if (!root) {
      root = new NgModuleScope();
      this.roots.set($injector, root);
      this.destroyWithApp($injector, root);
    }
    return root;
  }

  /**
   * Al destruir la app (`ApplicationRef.destroy()`): primero las ramas lazy (de la
   * más nueva a la más vieja, así una anidada cae antes que su padre), después la raíz.
   * Sin `ApplicationRef` (p.ej. `angular.mock.module` sin core) no hay nada que enganchar.
   */
  private destroyWithApp($injector: object, root: NgModuleScope): void {
    const injector = $injector as Partial<angular.auto.IInjectorService>;
    if (!injector.has?.(ApplicationRef.$name)) return;
    injector.get!<ApplicationRef>(ApplicationRef.$name).onDestroy(() => {
      const states = this.byState.get($injector);
      for (const scope of [...(states?.values() ?? [])].reverse()) scope.destroy();
      states?.clear();
      const routes = this.routeEnvironments.get($injector);
      for (const environment of [...(routes?.values() ?? [])].reverse()) environment.destroy();
      routes?.clear();
      root.destroy();
    });
  }

  /**
   * Scope nuevo para la rama lazy `stateName`, hijo del de la rama lazy ancestro más
   * cercana, con un entorno para `providers` (hijo del entorno ancestro).
   */
  createForState($injector: angular.auto.IInjectorService, stateName: string, providers: Provider[]): NgModuleScope {
    const parent = this.forState($injector, stateName);
    // Angular: el injector del módulo lazy es hijo del `route._injector` (Route.providers) de la misma ruta.
    const environment = ElementInjectorNode.environment(
      providers,
      this.environmentForState($injector, stateName, true),
      $injector,
    );
    const scope = new NgModuleScope(parent, environment);
    let states = this.byState.get($injector);
    if (!states) {
      states = new Map();
      this.byState.set($injector, states);
    }
    states.set(stateName, scope);
    return scope;
  }

  /** Las `declarations` de la rama lazy resuelven su DI contra `environment` (ver `scoped-injector-bridge`). */
  registerDeclarations($injector: object, classes: readonly Function[], environment: ElementInjectorNode): void {
    let byClass = this.environmentByClass.get($injector);
    if (!byClass) {
      byClass = new WeakMap();
      this.environmentByClass.set($injector, byClass);
    }
    for (const cls of classes) byClass.set(cls, environment);
  }

  environmentForClass($injector: object, cls: Function): ElementInjectorNode | undefined {
    return this.environmentByClass.get($injector)?.get(cls);
  }

  /** `true` si esta app tiene algún entorno posible (rama lazy o `Route.providers`) — si no, nada que buscar. */
  hasEnvironments($injector: object): boolean {
    return (this.byState.get($injector)?.size ?? 0) > 0 || routerRegistry.routeProviders.size > 0;
  }

  /**
   * Entorno de DI que aplica a `stateName` (Angular: `getClosestRouteInjector`): sube
   * desde el propio estado buscando la rama lazy o `Route.providers` más cercana. En un
   * mismo estado la rama lazy es hija de sus `Route.providers`, así que va primero.
   * `excludeOwnLazy`: una ruta `loadChildren` no usa el injector que ella misma carga.
   */
  environmentForState(
    $injector: angular.auto.IInjectorService,
    stateName: string,
    excludeOwnLazy = false,
  ): ElementInjectorNode | undefined {
    const segments = stateName ? stateName.split(".") : [];
    let own = true;
    while (segments.length) {
      const name = segments.join(".");
      if (!(own && excludeOwnLazy)) {
        const lazy = this.byState.get($injector)?.get(name)?.environment;
        if (lazy) return lazy;
      }
      const route = this.routeEnvironment($injector, name);
      if (route) return route;
      segments.pop();
      own = false;
    }
    return undefined;
  }

  /** Entorno de `Route.providers` de `stateName` (memo por app), hijo del entorno de su padre. */
  private routeEnvironment(
    $injector: angular.auto.IInjectorService,
    stateName: string,
  ): ElementInjectorNode | undefined {
    const providers = routerRegistry.routeProviders.get(stateName);
    if (!providers) return undefined;

    let environments = this.routeEnvironments.get($injector);
    if (!environments) {
      environments = new Map();
      this.routeEnvironments.set($injector, environments);
    }
    let environment = environments.get(stateName);
    if (!environment) {
      const parentState = stateName.split(".").slice(0, -1).join(".");
      environment = ElementInjectorNode.environment(
        providers,
        this.environmentForState($injector, parentState),
        $injector,
      );
      environments.set(stateName, environment);
      this.root($injector); // engancha el destroy con la app
    }
    return environment;
  }

  /** Scope que aplica a `stateName`: el de él mismo o su ancestro lazy más cercano; si no, la raíz. */
  forState($injector: object, stateName: string): NgModuleScope {
    const states = this.byState.get($injector);
    const segments = stateName.split(".");
    while (states && segments.length) {
      const scope = states.get(segments.join("."));
      if (scope) return scope;
      segments.pop();
    }
    return this.root($injector);
  }
}

export const ngModuleScopes = new NgModuleScopes();
