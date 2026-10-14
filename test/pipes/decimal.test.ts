import { describe, expect, it } from "vitest";
import { DecimalPipe } from "@/pipes/decimal.ts";

describe("etapa 11 — number / DecimalPipe (unidad, sin AngularJS)", () => {
  it("por defecto hasta 3 decimales, con separador de miles", () => {
    const pipe = new DecimalPipe("en-US");
    expect(pipe.transform(1234.5)).toBe("1,234.5");
    expect(pipe.transform(3.14159)).toBe("3.142");
  });

  it("digitsInfo como en Angular: enteros mínimos, decimales mínimos y máximos", () => {
    const pipe = new DecimalPipe("en-US");
    expect(pipe.transform(95.46, "1.0-0")).toBe("95");
    expect(pipe.transform(95.46, "1.1-1")).toBe("95.5");
    expect(pipe.transform(2, "1.2-2")).toBe("2.00");
    expect(pipe.transform(7, "3.0-0")).toBe("007");
    // Solo mínimo de decimales mayor que el máximo por defecto: el máximo sube a ese mínimo.
    expect(pipe.transform(1.23456, "1.4")).toBe("1.2346");
  });

  it("un digitsInfo inválido es error (el `number: 2` de AngularJS ya no vale)", () => {
    expect(() => new DecimalPipe("en-US").transform(1, "2")).toThrowError(/is not a valid digit info/);
  });

  it("vacío da null y un valor que no es número es error, como en Angular", () => {
    const pipe = new DecimalPipe("en-US");
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
    expect(pipe.transform("")).toBeNull();
    expect(pipe.transform("12.5")).toBe("12.5");
    expect(() => pipe.transform("abc")).toThrowError(/is not a number/);
  });

  it("formatea con el LOCALE_ID, o con el locale que se le pasa", () => {
    expect(new DecimalPipe("de-DE").transform(1234.5)).toBe("1.234,5");
    expect(new DecimalPipe("en-US").transform(1234.5, undefined, "de-DE")).toBe("1.234,5");
  });
});
