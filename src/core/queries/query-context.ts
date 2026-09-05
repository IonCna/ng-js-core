import type { IScope } from "angular";
import type { ViewQueryRegistry } from "@/core/queries/view-query-registry.ts";

// Array, no un solo registry: un directive sin scope propio (ej. <ng-content>,
// que vive DENTRO del template de un componente) comparte el mismo $scope que
// ESE componente — un solo slot por scope haría que el segundo controller en
// construirse pisara el registry del primero (confirmado con un bug real al
// integrar <ng-content>: el registry de Child, con su @ContentChild ya
// registrada, quedaba reemplazado por el de NgContent, vacío).
const registriesByScope = new WeakMap<IScope, ViewQueryRegistry[]>();

/** Ancla el registry de un controller a su propio `$scope` (agregando, no reemplazando — ver nota arriba). */
export function registerScopeQueryRegistry(scope: IScope, registry: ViewQueryRegistry): void {
  const existing = registriesByScope.get(scope);
  if (existing) existing.push(registry);
  else registriesByScope.set(scope, [registry]);
}

/** Todos los registries que se hayan anclado a los ancestros de `scope` (nunca al propio `scope` — ese es el/los de este controller, no el de un padre). */
export function getAncestorQueryRegistries(scope: IScope): readonly ViewQueryRegistry[] {
  const registries: ViewQueryRegistry[] = [];
  let current: IScope | null = scope.$parent;
  while (current) {
    registries.push(...getScopeViewQueryRegistries(current));
    current = current.$parent;
  }
  return registries;
}

/**
 * Registries "dueños" del contenido transcluido de un scope — quién debe
 * recibir los candidatos de `@ContentChild`/`@ContentChildren` cuando ese
 * scope publica un controller. Distinto de `findParentQueryRegistry`: en una
 * directiva con `transclude`, el `$parent` del scope transcluido es el scope
 * de quien ESCRIBIÓ el contenido, no el del componente que lo recibe — por
 * eso hace falta un binding explícito (lo arma `<ng-content>` en su propio
 * `$postLink`, ver `ng-content.ts`).
 */
const contentOwnersByScope = new WeakMap<IScope, readonly ViewQueryRegistry[]>();
const activeContentOwners: Array<readonly ViewQueryRegistry[]> = [];

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

/** Usado por `<ng-content>` mientras clona su contenido transcluido — ver `ng-content.ts`. */
export function runWithContentQueryOwners<T>(owners: readonly ViewQueryRegistry[], callback: () => T): T {
  activeContentOwners.push(owners);
  try {
    return callback();
  } finally {
    activeContentOwners.pop();
  }
}

/** El/los registry(s) anclados EXACTAMENTE a `scope` (no ancestros — para eso está `getAncestorQueryRegistries`). */
export function getScopeViewQueryRegistries(scope: IScope): readonly ViewQueryRegistry[] {
  return registriesByScope.get(scope) ?? [];
}
