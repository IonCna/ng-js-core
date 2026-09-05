import type { IScope } from "angular";
import type { ViewQueryRegistry } from "@/core/queries/view-query-registry.ts";

const registryByScope = new WeakMap<IScope, ViewQueryRegistry>();

/** Ancla el registry de un controller a su propio `$scope`, para que sus hijos lo encuentren subiendo `$parent`. */
export function registerScopeQueryRegistry(scope: IScope, registry: ViewQueryRegistry): void {
  registryByScope.set(scope, registry);
}

/** Busca el registry del ancestro más cercano — arranca en `scope.$parent`, nunca en el propio `scope` (ese es el registry DE este controller, no el de un padre). */
export function findParentQueryRegistry(scope: IScope): ViewQueryRegistry | undefined {
  let current: IScope | null = scope.$parent;
  while (current) {
    const registry = registryByScope.get(current);
    if (registry) return registry;
    current = current.$parent;
  }
  return undefined;
}
