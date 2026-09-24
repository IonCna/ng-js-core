import { describe, expect, it } from "vitest";
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
