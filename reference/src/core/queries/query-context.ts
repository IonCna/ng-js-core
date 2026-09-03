import type { IScope } from "angular";
import type { ViewQueryRegistry } from "@/core/queries/view-query-registry";

const activeContentOwners: Array<readonly ViewQueryRegistry[]> = [];
const activeRegistries: ViewQueryRegistry[] = [];
const contentOwnersByScope = new WeakMap<IScope, readonly ViewQueryRegistry[]>();
const controllerRegistries = new WeakMap<object, ViewQueryRegistry>();
const scopeRegistries = new WeakMap<IScope, ViewQueryRegistry[]>();

export function pushActiveViewQueryRegistry(registry: ViewQueryRegistry): void {
  activeRegistries.push(registry);
}

export function popActiveViewQueryRegistry(registry: ViewQueryRegistry): void {
  const index = activeRegistries.lastIndexOf(registry);
  if (index !== -1) activeRegistries.splice(index, 1);
}

export function registerControllerViewQueryRegistry(controller: object, registry: ViewQueryRegistry): () => void {
  controllerRegistries.set(controller, registry);
  return () => controllerRegistries.delete(controller);
}

export function registerScopeViewQueryRegistry(scope: IScope, registry: ViewQueryRegistry): () => void {
  const registries = scopeRegistries.get(scope);
  if (registries) registries.push(registry);
  else scopeRegistries.set(scope, [registry]);

  return () => {
    const currentRegistries = scopeRegistries.get(scope);
    if (!currentRegistries) return;

    const index = currentRegistries.indexOf(registry);
    if (index !== -1) currentRegistries.splice(index, 1);
    if (currentRegistries.length === 0) scopeRegistries.delete(scope);
  };
}

export function getActiveViewQueryRegistry(): ViewQueryRegistry | undefined {
  return activeRegistries.at(-1);
}

export function getControllerViewQueryRegistry(controller: object): ViewQueryRegistry | undefined {
  return controllerRegistries.get(controller);
}

export function getScopeViewQueryRegistry(scope: IScope): ViewQueryRegistry | undefined {
  return scopeRegistries.get(scope)?.at(-1);
}

export function getScopeViewQueryRegistries(scope: IScope): readonly ViewQueryRegistry[] {
  return scopeRegistries.get(scope) ?? [];
}

export function runWithContentQueryOwners<T>(owners: readonly ViewQueryRegistry[], callback: () => T): T {
  activeContentOwners.push(owners);
  try {
    return callback();
  } finally {
    activeContentOwners.pop();
  }
}

export function bindContentQueryOwners(scope: IScope, owners: readonly ViewQueryRegistry[]): void {
  contentOwnersByScope.set(scope, owners);
  scope.$on("$destroy", () => {
    if (contentOwnersByScope.get(scope) === owners) contentOwnersByScope.delete(scope);
  });
}

export function getContentQueryOwners(scope: IScope): readonly ViewQueryRegistry[] {
  const activeOwners = activeContentOwners.at(-1);
  if (activeOwners) return activeOwners;

  let current: IScope | null = scope;
  while (current) {
    const owners = contentOwnersByScope.get(current);
    if (owners) return owners;
    current = current.$parent;
  }

  return [];
}
