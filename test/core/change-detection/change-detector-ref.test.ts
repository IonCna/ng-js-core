import angular from "angular";
import { describe, expect, it } from "vitest";
import { ChangeDetectorRefImpl } from "@/core/change-detection/change-detector-ref.ts";

function freshScope(): angular.IScope {
  const injector = angular.injector(["ng"]);
  return injector.get<angular.IRootScopeService>("$rootScope").$new();
}

describe("etapa 6 — ChangeDetectorRef (contra un $scope real)", () => {
  it("markForCheck() es no-op: no dispara ningún $digest por sí solo", () => {
    const scope = freshScope();
    let watchCalls = 0;
    scope.$watch(() => "x", () => {
      watchCalls++;
    });
    scope.$digest();
    const afterFirstDigest = watchCalls;

    const cdr = new ChangeDetectorRefImpl(scope);
    cdr.markForCheck();

    expect(watchCalls).toBe(afterFirstDigest);
  });

  it("detectChanges() fuerza un $digest síncrono", () => {
    const scope = freshScope();
    (scope as unknown as { n: number }).n = 1;
    let seen = 0;
    scope.$watch("n", (value: number) => {
      seen = value;
    });

    const cdr = new ChangeDetectorRefImpl(scope);
    expect(seen).toBe(0);

    cdr.detectChanges();
    expect(seen).toBe(1);
  });

  it("detach()/reattach() usan $scope.$suspend()/$resume()", () => {
    const scope = freshScope();
    const cdr = new ChangeDetectorRefImpl(scope);

    cdr.detach();
    expect(scope.$isSuspended()).toBe(true);

    cdr.reattach();
    expect(scope.$isSuspended()).toBe(false);
  });

  it("después de $destroy, detectChanges()/detach()/reattach() no hacen nada y no explotan", () => {
    const scope = freshScope();
    const cdr = new ChangeDetectorRefImpl(scope);
    scope.$destroy();

    expect(() => cdr.detectChanges()).not.toThrow();
    expect(() => cdr.detach()).not.toThrow();
    expect(() => cdr.reattach()).not.toThrow();
  });
});
