import type { IScope } from "angular";
import type { ViewQueryRegistry } from "@/core/queries/view-query-registry.ts";

/**
 * Dónde encuentra cada controller las queries a las que se tiene que publicar como candidato:
 * - de vista: los `ViewQueryRegistry` de los scopes ancestros (el componente cuya vista lo contiene);
 * - de contenido: los "dueños" que bindeó la proyección (`<ng-content>`/proyección eager) sobre el scope del
 *   contenido transcluido, o los activos mientras se linkea (`runWithContentOwners`).
 */
export class QueryContext {
  private static readonly registriesByScope = new WeakMap<IScope, ViewQueryRegistry[]>();
  private static readonly contentOwnersByScope = new WeakMap<IScope, ViewQueryRegistry[]>();
  private static readonly activeContentOwners: ViewQueryRegistry[][] = [];

  static registerScopeRegistry(scope: IScope, registry: ViewQueryRegistry): void {
    const existing = QueryContext.registriesByScope.get(scope);
    if (existing) existing.push(registry);
    else QueryContext.registriesByScope.set(scope, [registry]);
  }

  static scopeRegistries(scope: IScope): ViewQueryRegistry[] {
    return QueryContext.registriesByScope.get(scope) ?? [];
  }

  /**
   * `scope` y los scopes de los que hereda por prototipo (`ng-repeat`, `ng-if`, …): el mismo template, como las
   * variables de un template de Angular. Corta en un scope aislado (el template de otro componente): su prototipo ya
   * no es un scope.
   */
  static lexicalScopes(scope: IScope): IScope[] {
    const scopes: IScope[] = [];
    for (let current: IScope | null = scope; current && Object.hasOwn(current, "$id"); current = Object.getPrototypeOf(current)) {
      scopes.push(current);
    }
    return scopes;
  }

  static ancestorRegistries(scope: IScope): ViewQueryRegistry[] {
    const registries: ViewQueryRegistry[] = [];
    for (let current = scope.$parent; current; current = current.$parent) {
      registries.push(...QueryContext.scopeRegistries(current));
    }
    return registries;
  }

  static bindContentOwners(scope: IScope, owners: ViewQueryRegistry[]): void {
    QueryContext.contentOwnersByScope.set(scope, owners);
    scope.$on("$destroy", () => {
      if (QueryContext.contentOwnersByScope.get(scope) === owners) QueryContext.contentOwnersByScope.delete(scope);
    });
  }

  static contentOwners(scope: IScope): ViewQueryRegistry[] {
    const active = QueryContext.activeContentOwners.at(-1);
    if (active) return active;
    for (let current: IScope | null = scope; current; current = current.$parent) {
      const owners = QueryContext.contentOwnersByScope.get(current);
      if (owners) return owners;
    }
    return [];
  }

  static runWithContentOwners<T>(owners: ViewQueryRegistry[], callback: () => T): T {
    QueryContext.activeContentOwners.push(owners);
    try {
      return callback();
    } finally {
      QueryContext.activeContentOwners.pop();
    }
  }
}
