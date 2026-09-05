import angular from "angular";
import { describe, expect, it } from "vitest";
import { percentFilter } from "@/pipes/percent.ts";

describe("etapa 11 — percent (unidad, sin AngularJS)", () => {
  it("formatea con 0 decimales por default (digitsInfo 1.0-0)", () => {
    const filter = percentFilter();
    expect(filter(0.25)).toBe("25%");
    expect(filter(1)).toBe("100%");
  });

  it("acepta digitsInfo para controlar decimales", () => {
    const filter = percentFilter();
    expect(filter(0.1234, "1.2-2")).toBe("12.34%");
  });

  it("null/undefined/string vacío/no-numérico da string vacío", () => {
    const filter = percentFilter();
    expect(filter(null)).toBe("");
    expect(filter(undefined)).toBe("");
    expect(filter("")).toBe("");
    expect(filter("no-es-un-numero")).toBe("");
  });

  it("acepta un string numérico", () => {
    const filter = percentFilter();
    expect(filter("0.5")).toBe("50%");
  });
});

describe("etapa 11 — percent registrado como .filter() real", () => {
  it("funciona en una expresión de template real", () => {
    const name = "percentFilterTest";
    angular.module(name, []).filter("percent", percentFilter);

    const host = document.createElement("div");
    host.innerHTML = "{{ 0.42 | percent }}";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.textContent?.trim()).toBe("42%");
  });
});
