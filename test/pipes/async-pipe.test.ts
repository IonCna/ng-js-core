import angular from "angular";
import { Subject } from "rxjs";
import { describe, expect, it } from "vitest";
import { AsyncFilterPipe, AsyncPipeImpl } from "@/pipes/async-pipe.ts";

function freshScope(): angular.IScope {
  const injector = angular.injector(["ng"]);
  return injector.get<angular.IRootScopeService>("$rootScope").$new();
}

describe("etapa 11 — AsyncPipe (contra un $scope real)", () => {
  it("null/undefined da null, sin suscribirse a nada", () => {
    const pipe = new AsyncPipeImpl(freshScope());
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
  });

  it("un Observable: arranca en null, refleja cada emisión", () => {
    const scope = freshScope();
    const pipe = new AsyncPipeImpl(scope);
    const subject = new Subject<number>();

    expect(pipe.transform(subject)).toBeNull();

    subject.next(1);
    expect(pipe.transform(subject)).toBe(1);

    subject.next(2);
    expect(pipe.transform(subject)).toBe(2);
  });

  it("llamar transform() varias veces con el MISMO observable no se suscribe de nuevo", () => {
    const scope = freshScope();
    const pipe = new AsyncPipeImpl(scope);
    let subscribeCalls = 0;
    const subject = new Subject<number>();
    const original = subject.subscribe.bind(subject);
    subject.subscribe = ((...args: Parameters<typeof subject.subscribe>) => {
      subscribeCalls++;
      return original(...args);
    }) as typeof subject.subscribe;

    pipe.transform(subject);
    pipe.transform(subject);
    pipe.transform(subject);

    expect(subscribeCalls).toBe(1);
  });

  it("un Promise: resuelve async, refleja el valor cuando llega", async () => {
    const scope = freshScope();
    const pipe = new AsyncPipeImpl(scope);
    const promise = Promise.resolve("listo");

    expect(pipe.transform(promise)).toBeNull();

    await promise;
    await Promise.resolve(); // deja correr el .then() interno del pipe

    expect(pipe.transform(promise)).toBe("listo");
  });

  it("$scope.$destroy() se desuscribe: emisiones posteriores no se reflejan más", () => {
    const scope = freshScope();
    const pipe = new AsyncPipeImpl(scope);
    const subject = new Subject<number>();

    pipe.transform(subject); // suscribe
    subject.next(1);
    expect(pipe.transform(subject)).toBe(1);

    scope.$destroy();
    subject.next(2);

    expect(pipe.transform(subject)).toBeNull(); // destruido: transform() ya no hace nada
    expect(subject.observed).toBe(false); // y de verdad se desuscribió del Subject
  });
});

describe("etapa 11 — `| async` como filtro (AsyncFilterPipe, contra $compile real)", () => {
  function compile(template: string, context: Record<string, unknown>) {
    const filter = new AsyncFilterPipe();
    angular.module("asyncFilterTest", []).filter("async", () => {
      const fn = (input: unknown, scope: unknown) => filter.transform(input, scope);
      return Object.assign(fn, { $stateful: true });
    });
    const injector = angular.injector(["ng", "asyncFilterTest"]);
    const scope = Object.assign(injector.get<angular.IRootScopeService>("$rootScope").$new(), context);
    const element = injector.get<angular.ICompileService>("$compile")(template)(scope);
    scope.$digest();
    return { element, scope, filter };
  }

  it("pinta cada emisión y re-renderiza un ng-repeat", () => {
    const name$ = new Subject<string>();
    const items$ = new Subject<number[]>();
    const { element, scope } = compile(
      '<div><p>{{ name$ | async:this }}</p><li ng-repeat="n in items$ | async:this track by n">{{ n }}</li></div>',
      { name$, items$ },
    );
    name$.next("Ana");
    items$.next([1, 2]);
    scope.$digest();
    expect(element.find("p").text()).toBe("Ana");
    expect(element.find("li").length).toBe(2);
  });

  it("se desuscribe cuando ng-if destruye su scope, y se vuelve a suscribir al mostrarse (como la vista de Angular)", () => {
    const name$ = new Subject<string>();
    const { scope } = compile('<div><p ng-if="show">{{ name$ | async:this }}</p></div>', { name$, show: true });
    expect(name$.observed).toBe(true);
    scope["show"] = false;
    scope.$digest();
    expect(name$.observed).toBe(false);
    scope["show"] = true;
    scope.$digest();
    expect(name$.observed).toBe(true);
  });

  it("sin scope (template que no pasó por el compilador de templates) es error claro", () => {
    expect(() => new AsyncFilterPipe().transform(new Subject())).toThrowError(/falta el scope/);
  });
});
