import angular from "angular";
import { describe, expect, it } from "vitest";
import { createPipeFilter } from "@/pipes/pipe-transform.ts";
import { TitleCasePipe } from "@/pipes/title-case.ts";

describe("etapa 11 — titlecase (unidad, sin AngularJS)", () => {
  it("mayúscula la primera letra de cada palabra, minúscula el resto", () => {
    const pipe = new TitleCasePipe();
    expect(pipe.transform("hello world")).toBe("Hello World");
    expect(pipe.transform("HELLO WORLD")).toBe("Hello World");
  });

  it("null/undefined da string vacío", () => {
    const pipe = new TitleCasePipe();
    expect(pipe.transform(null)).toBe("");
    expect(pipe.transform(undefined)).toBe("");
  });
});

describe("etapa 11 — titlecase registrado como .filter() real", () => {
  it("funciona en una expresión de template real", () => {
    const name = "titleCaseFilterTest";
    angular.module(name, []).filter("titlecase", createPipeFilter(TitleCasePipe));

    const host = document.createElement("div");
    host.innerHTML = "{{ 'hola mundo' | titlecase }}";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.textContent?.trim()).toBe("Hola Mundo");
  });
});
