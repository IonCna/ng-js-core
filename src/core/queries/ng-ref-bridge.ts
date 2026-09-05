import type angular from "angular";
import { chainInstanceMethod, decorateControllerWith } from "@/core/lifecycle/shared.ts";
import { getControllerTokens } from "@/core/queries/controller-tokens.ts";
import { findParentQueryRegistry, registerScopeQueryRegistry } from "@/core/queries/query-context.ts";
import { createDecoratedViewChildQueries, ViewChildQuery } from "@/core/queries/view-child.ts";
import { createDecoratedViewChildrenQueries, ViewChildrenQuery } from "@/core/queries/view-children.ts";
import { ViewQueryRegistry } from "@/core/queries/view-query-registry.ts";

/**
 * Por cada controller instanciado: arma su propio `ViewQueryRegistry`,
 * "instala" sus queries (`viewChild()`/`@ViewChild`, reemplaza el campo por
 * un getter que lee `.value`), se publica como candidato en el registry del
 * padre más cercano (por su cadena de clases, automático), y engancha
 * `resolve()` a `$postLink` — ahí ya está garantizado que los hijos se
 * publicaron (AngularJS linkea de abajo hacia arriba).
 */
export function decorateControllerViewChildQueries($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!instance || typeof instance !== "object") return;

      const $scope = locals?.$scope as angular.IScope | undefined;
      const registry = new ViewQueryRegistry();

      installOwnQueries(instance, registry);

      if ($scope) {
        registerScopeQueryRegistry($scope, registry);
        publishToParent(instance, $scope);
        $scope.$on("$destroy", () => registry.destroy());
      }

      chainInstanceMethod(instance, "$postLink", () => registry.resolve());
    },
  });
}
decorateControllerViewChildQueries.$inject = ["$delegate"];

function installOwnQueries(instance: object, registry: ViewQueryRegistry): void {
  for (const key of Reflect.ownKeys(instance)) {
    const descriptor = Object.getOwnPropertyDescriptor(instance, key);
    if (!descriptor) continue;

    if (descriptor.value instanceof ViewChildQuery) {
      installQuery(instance, key, descriptor.value, registry, descriptor.enumerable ?? true);
    } else if (descriptor.value instanceof ViewChildrenQuery) {
      installChildrenQuery(instance, key, descriptor.value, registry, descriptor.enumerable ?? true);
    }
  }

  for (const { propertyKey, query } of createDecoratedViewChildQueries(instance)) {
    installQuery(instance, propertyKey, query, registry, true);
  }

  for (const { propertyKey, query } of createDecoratedViewChildrenQueries(instance)) {
    installChildrenQuery(instance, propertyKey, query, registry, true);
  }
}

function installQuery(instance: object, key: PropertyKey, query: ViewChildQuery<unknown>, registry: ViewQueryRegistry, enumerable: boolean): void {
  registry.registerQuery(query);
  Object.defineProperty(instance, key, {
    configurable: true,
    enumerable,
    get: () => query.value,
  });
}

function installChildrenQuery(instance: object, key: PropertyKey, query: ViewChildrenQuery<unknown>, registry: ViewQueryRegistry, enumerable: boolean): void {
  registry.registerChildrenQuery(query);
  Object.defineProperty(instance, key, {
    configurable: true,
    enumerable,
    get: () => query.value,
  });
}

function publishToParent(instance: object, $scope: angular.IScope): void {
  const parentRegistry = findParentQueryRegistry($scope);
  if (!parentRegistry) return;

  const tokens = getControllerTokens(instance);
  if (tokens.length === 0) return;

  parentRegistry.registerCandidate(tokens, instance);
}
