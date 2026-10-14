import { describe, expect, it } from "vitest";
import { PercentPipe } from "@/pipes/percent.ts";

describe("etapa 11 — percent (unidad, sin AngularJS)", () => {
  it("formatea con 0 decimales por default (digitsInfo 1.0-0)", () => {
    const pipe = new PercentPipe("en-US");
    expect(pipe.transform(0.25)).toBe("25%");
    expect(pipe.transform(1)).toBe("100%");
  });

  it("acepta digitsInfo para controlar decimales", () => {
    const pipe = new PercentPipe("en-US");
    expect(pipe.transform(0.1234, "1.2-2")).toBe("12.34%");
    expect(pipe.transform(0.4375, "1.0-2")).toBe("43.75%");
  });

  it("formatea con el LOCALE_ID, o con el locale que se le pasa", () => {
    expect(new PercentPipe("de-DE").transform(0.5)).toBe("50 %");
    expect(new PercentPipe("en-US").transform(0.5, undefined, "de-DE")).toBe("50 %");
  });

  it("null/undefined/string vacío da null, como en Angular", () => {
    const pipe = new PercentPipe("en-US");
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
    expect(pipe.transform("")).toBeNull();
  });

  it("un valor que no es número es error, como en Angular", () => {
    expect(() => new PercentPipe("en-US").transform("no-es-un-numero")).toThrowError(/is not a number/);
  });

  it("acepta un string numérico", () => {
    const pipe = new PercentPipe("en-US");
    expect(pipe.transform("0.5")).toBe("50%");
  });
});
