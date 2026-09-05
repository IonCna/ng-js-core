import angular from "angular";
import { Subject } from "rxjs";
import { describe, expect, it } from "vitest";
import { DestroyRefImpl } from "@/rxjs-interop/destroy-ref.ts";
import { takeUntilDestroyed } from "@/rxjs-interop/take-until-destroyed.ts";

function freshScope(): angular.IScope {
  const injector = angular.injector(["ng"]);
  return injector.get<angular.IRootScopeService>("$rootScope").$new();
}

describe("etapa 12 — takeUntilDestroyed", () => {
  it("deja pasar emisiones normalmente antes de destruirse", () => {
    const scope = freshScope();
    const destroyRef = new DestroyRefImpl(scope);
    const source = new Subject<number>();
    const seen: number[] = [];

    source.pipe(takeUntilDestroyed(destroyRef)).subscribe((value) => seen.push(value));

    source.next(1);
    source.next(2);

    expect(seen).toEqual([1, 2]);
  });

  it("completa el observable resultante cuando se destruye el $scope — nada llega después", () => {
    const scope = freshScope();
    const destroyRef = new DestroyRefImpl(scope);
    const source = new Subject<number>();
    const seen: number[] = [];
    let completed = false;

    source.pipe(takeUntilDestroyed(destroyRef)).subscribe({
      next: (value) => seen.push(value),
      complete: () => {
        completed = true;
      },
    });

    source.next(1);
    scope.$destroy();
    source.next(2); // ya completado: no debería llegar

    expect(seen).toEqual([1]);
    expect(completed).toBe(true);
  });

  it("si el DestroyRef ya estaba destruido, completa apenas alguien se suscribe", () => {
    const scope = freshScope();
    const destroyRef = new DestroyRefImpl(scope);
    scope.$destroy();

    const source = new Subject<number>();
    let completed = false;

    source.pipe(takeUntilDestroyed(destroyRef)).subscribe({ complete: () => (completed = true) });

    expect(completed).toBe(true);
  });
});
