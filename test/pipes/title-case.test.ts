import angular from "angular";
import { describe, expect, it } from "vitest";
import { titleCaseFilter } from "@/pipes/title-case.ts";

describe("etapa 11 — titlecase (unidad, sin AngularJS)", () => {
  it("mayúscula la primera letra de cada palabra, minúscula el resto", () => {
    const filter = titleCaseFilter();
    expect(filter("hello world")).toBe("Hello World");
    expect(filter("HELLO WORLD")).toBe("Hello World");
  });

  it("null/undefined da string vacío", () => {
    const filter = titleCaseFilter();
    expect(filter(null)).toBe("");
    expect(filter(undefined)).toBe("");
  });
});

describe("etapa 11 — titlecase registrado como .filter() real", () => {
  it("funciona en una expresión de template real", () => {
    const name = "titleCaseFilterTest";
    angular.module(name, []).filter("titlecase", titleCaseFilter);

    const host = document.createElement("div");
    host.innerHTML = "{{ 'hola mundo' | titlecase }}";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.textContent?.trim()).toBe("Hola Mundo");
  });
});
