import angular from "angular";
import { Subject } from "rxjs";
import { describe, expect, it } from "vitest";
import { AsyncPipeImpl } from "@/pipes/async-pipe.ts";

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
