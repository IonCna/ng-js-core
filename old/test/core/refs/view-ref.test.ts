import angular from "angular";
import { describe, expect, it } from "vitest";
import { ViewRefImpl } from "@/core/refs/view-ref.ts";

function freshScope(): angular.IScope {
  const injector = angular.injector(["ng"]);
  return injector.get<angular.IRootScopeService>("$rootScope").$new();
}

describe("etapa 6 — ViewRef (contra un $scope real)", () => {
  it("destroy() saca los rootNodes del DOM y destruye el scope", () => {
    const scope = freshScope();
    const parent = document.createElement("div");
    const node = document.createElement("span");
    parent.appendChild(node);

    let scopeDestroyed = false;
    scope.$on("$destroy", () => {
      scopeDestroyed = true;
    });

    const viewRef = new ViewRefImpl(scope, [node]);
    viewRef.destroy();

    expect(parent.contains(node)).toBe(false);
    expect(scopeDestroyed).toBe(true);
    expect(viewRef.destroyed).toBe(true);
  });

  it("destroy() es idempotente: corre una sola vez aunque se llame varias veces", () => {
    const scope = freshScope();
    let destroyCount = 0;
    scope.$on("$destroy", () => destroyCount++);

    const viewRef = new ViewRefImpl(scope);
    viewRef.destroy();
    viewRef.destroy();

    expect(destroyCount).toBe(1);
  });

  it("onDestroy() corre los callbacks en orden al destruir; después de destruido no se agregan más", () => {
    const scope = freshScope();
    const order: string[] = [];

    const viewRef = new ViewRefImpl(scope);
    viewRef.onDestroy(() => order.push("a"));
    viewRef.onDestroy(() => order.push("b"));
    viewRef.destroy();
    viewRef.onDestroy(() => order.push("c"));

    expect(order).toEqual(["a", "b"]);
  });

  it("es también un ChangeDetectorRef: detectChanges() fuerza un $digest", () => {
    const scope = freshScope();
    (scope as unknown as { n: number }).n = 1;
    let seen = 0;
    scope.$watch("n", (value: number) => {
      seen = value;
    });

    const viewRef = new ViewRefImpl(scope);
    viewRef.detectChanges();

    expect(seen).toBe(1);
  });
});
