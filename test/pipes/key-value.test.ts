import angular from "angular";
import { describe, expect, it } from "vitest";
import { KeyValuePipe, type KeyValue } from "@/pipes/key-value.ts";
import { createPipeFilter } from "@/pipes/pipe-transform.ts";

describe("etapa 11 — keyvalue (unidad, sin AngularJS)", () => {
  it("un objeto plano se convierte en {key, value}[], ordenado por clave por default", () => {
    const pipe = new KeyValuePipe();
    expect(pipe.transform({ b: 2, a: 1 })).toEqual([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
  });

  it("un Map también funciona", () => {
    const pipe = new KeyValuePipe();
    const map = new Map<string, number>([
      ["z", 1],
      ["a", 2],
    ]);
    expect(pipe.transform(map)).toEqual([
      { key: "a", value: 2 },
      { key: "z", value: 1 },
    ]);
  });

  it("acepta un compareFn propio", () => {
    const pipe = new KeyValuePipe();
    const byValueDesc = (a: KeyValue<unknown, unknown>, b: KeyValue<unknown, unknown>) => (b.value as number) - (a.value as number);
    expect(pipe.transform({ a: 1, b: 3, c: 2 }, byValueDesc)).toEqual([
      { key: "b", value: 3 },
      { key: "c", value: 2 },
      { key: "a", value: 1 },
    ]);
  });

  it("null/undefined da un array vacío", () => {
    const pipe = new KeyValuePipe();
    expect(pipe.transform(null)).toEqual([]);
    expect(pipe.transform(undefined)).toEqual([]);
  });
});

describe("etapa 11 — keyvalue registrado como .filter() real", () => {
  it("funciona en una expresión de template real", () => {
    const name = "keyValueFilterTest";
    angular.module(name, []).filter("keyvalue", createPipeFilter(KeyValuePipe));

    const host = document.createElement("div");
    host.innerHTML = '<div ng-repeat="item in ({b: 2, a: 1} | keyvalue)">{{item.key}}={{item.value}};</div>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.textContent?.replace(/\s+/g, "")).toBe("a=1;b=2;");
  });

  it("queda marcado $stateful (lo que $filter('keyvalue') devuelve, no el factory de registro)", () => {
    const name = "keyValueStatefulTest";
    angular.module(name, []).filter("keyvalue", createPipeFilter(KeyValuePipe));

    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $filter = injector.get<angular.IFilterService>("$filter");

    expect(($filter("keyvalue") as unknown as { $stateful?: boolean }).$stateful).toBe(true);
  });
});
