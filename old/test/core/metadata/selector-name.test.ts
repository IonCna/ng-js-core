import { describe, expect, it } from "vitest";
import { parseSelector, selectorToRegistrationName, toKebabCase } from "@/core/metadata/selector-name.ts";

describe("toKebabCase", () => {
  it("camelCase a kebab-case", () => {
    expect(toKebabCase("ngbNavLink")).toBe("ngb-nav-link");
    expect(toKebabCase("plain")).toBe("plain");
  });
});

describe("parseSelector", () => {
  it("tag simple: restrict E, sin refine", () => {
    expect(parseSelector("my-cosa")).toEqual({ registrationName: "myCosa", restrict: "E", refine: undefined });
  });

  it("[attr] simple: restrict A, sin refine", () => {
    expect(parseSelector("[ngbNavOutlet]")).toEqual({
      registrationName: "ngbNavOutlet",
      restrict: "A",
      refine: undefined,
    });
  });

  it("compuesto tag[attr]: restrict A por el atributo, refine con el selector completo en kebab-case", () => {
    expect(parseSelector("button[ngbNavLink]")).toEqual({
      registrationName: "ngbNavLink",
      restrict: "A",
      refine: "button[ngb-nav-link]",
    });
  });

  it("compuesto tag[attr] con otro tag: mismo registro, refine distinto", () => {
    expect(parseSelector("ng-template[ngbNavContent]")).toEqual({
      registrationName: "ngbNavContent",
      restrict: "A",
      refine: "ng-template[ngb-nav-content]",
    });
  });

  it(":not(...) genera refine aunque el atributo sea el mismo", () => {
    const parsed = parseSelector("[ngbNavLink]:not([disabled])");
    expect(parsed.registrationName).toBe("ngbNavLink");
    expect(parsed.restrict).toBe("A");
    expect(parsed.refine).toBe("[ngb-nav-link]:not([disabled])");
  });

  it("lista separada por coma con el mismo atributo: un solo registro, refine con la lista completa", () => {
    const parsed = parseSelector("a[ngbNavLink], button[ngbNavLink]");
    expect(parsed.registrationName).toBe("ngbNavLink");
    expect(parsed.restrict).toBe("A");
    expect(parsed.refine).toBe("a[ngb-nav-link], button[ngb-nav-link]");
  });

  it("varios nombres de atributo distintos: no soportado, tira error claro", () => {
    expect(() => parseSelector("[foo], [bar]")).toThrow(/varios nombres de atributo distintos/);
  });

  it("varios tags distintos sin atributo: no soportado, tira error claro", () => {
    expect(() => parseSelector("div, span")).toThrow(/único tag\/atributo disparador/);
  });
});

describe("selectorToRegistrationName", () => {
  it("delega en parseSelector().registrationName", () => {
    expect(selectorToRegistrationName("[ngbNavOutlet]")).toBe("ngbNavOutlet");
    expect(selectorToRegistrationName("button[ngbNavLink]")).toBe("ngbNavLink");
    expect(selectorToRegistrationName("my-cosa")).toBe("myCosa");
  });
});
