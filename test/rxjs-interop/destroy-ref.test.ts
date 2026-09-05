import angular from "angular";
import { describe, expect, it } from "vitest";
import { DestroyRefImpl } from "@/rxjs-interop/destroy-ref.ts";

function freshScope(): angular.IScope {
  const injector = angular.injector(["ng"]);
  return injector.get<angular.IRootScopeService>("$rootScope").$new();
}

describe("etapa 12 — DestroyRef (contra un $scope real)", () => {
  it("onDestroy corre cuando se destruye el $scope", () => {
    const scope = freshScope();
    const destroyRef = new DestroyRefImpl(scope);
    let called = false;

    destroyRef.onDestroy(() => {
      called = true;
    });

    expect(called).toBe(false);
    scope.$destroy();
    expect(called).toBe(true);
  });

  it("corre todos los callbacks registrados, en cualquier cantidad", () => {
    const scope = freshScope();
    const destroyRef = new DestroyRefImpl(scope);
    const order: string[] = [];

    destroyRef.onDestroy(() => order.push("a"));
    destroyRef.onDestroy(() => order.push("b"));
    scope.$destroy();

    expect(order).toEqual(["a", "b"]);
  });

  it("la función de unregister corta un callback antes de que se destruya", () => {
    const scope = freshScope();
    const destroyRef = new DestroyRefImpl(scope);
    let called = false;

    const unregister = destroyRef.onDestroy(() => {
      called = true;
    });
    unregister();
    scope.$destroy();

    expect(called).toBe(false);
  });

  it("si el scope YA se destruyó, onDestroy() llama al callback de inmediato", () => {
    const scope = freshScope();
    const destroyRef = new DestroyRefImpl(scope);
    scope.$destroy();

    let called = false;
    destroyRef.onDestroy(() => {
      called = true;
    });

    expect(called).toBe(true);
  });
});
