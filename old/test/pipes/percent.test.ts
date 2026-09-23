import angular from "angular";
import { describe, expect, it } from "vitest";
import { PercentPipe } from "@/pipes/percent.ts";
import { createPipeFilter } from "@/pipes/pipe-transform.ts";

describe("etapa 11 — percent (unidad, sin AngularJS)", () => {
  it("formatea con 0 decimales por default (digitsInfo 1.0-0)", () => {
    const pipe = new PercentPipe();
    expect(pipe.transform(0.25)).toBe("25%");
    expect(pipe.transform(1)).toBe("100%");
  });

  it("acepta digitsInfo para controlar decimales", () => {
    const pipe = new PercentPipe();
    expect(pipe.transform(0.1234, "1.2-2")).toBe("12.34%");
  });

  it("null/undefined/string vacío/no-numérico da string vacío", () => {
    const pipe = new PercentPipe();
    expect(pipe.transform(null)).toBe("");
    expect(pipe.transform(undefined)).toBe("");
    expect(pipe.transform("")).toBe("");
    expect(pipe.transform("no-es-un-numero")).toBe("");
  });

  it("acepta un string numérico", () => {
    const pipe = new PercentPipe();
    expect(pipe.transform("0.5")).toBe("50%");
  });
});

describe("etapa 11 — percent registrado como .filter() real", () => {
  it("funciona en una expresión de template real", () => {
    const name = "percentFilterTest";
    angular.module(name, []).filter("percent", createPipeFilter(PercentPipe));

    const host = document.createElement("div");
    host.innerHTML = "{{ 0.42 | percent }}";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.textContent?.trim()).toBe("42%");
  });
});
