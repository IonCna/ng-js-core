import { describe, expect, it } from "vitest";
import { CurrencyPipe } from "@/pipes/currency.ts";

describe("etapa 11 — currency / CurrencyPipe (unidad, sin AngularJS)", () => {
  it("por defecto DEFAULT_CURRENCY_CODE con símbolo y los decimales de la moneda; el signo va delante", () => {
    const pipe = new CurrencyPipe("en-US", "USD");
    expect(pipe.transform(1234.5)).toBe("$1,234.50");
    expect(pipe.transform(-1234.5)).toBe("-$1,234.50");
  });

  it("código, display y digitsInfo como en Angular", () => {
    const pipe = new CurrencyPipe("en-US", "USD");
    expect(pipe.transform(10, "EUR")).toBe("€10.00");
    expect(pipe.transform(10, "MXN", "symbol-narrow")).toBe("$10.00");
    expect(pipe.transform(10, "USD", "code")).toBe("USD 10.00");
    expect(pipe.transform(10, "USD", "Q")).toBe("Q10.00");
    expect(pipe.transform(1234.56, "USD", "symbol", "1.0-0")).toBe("$1,235");
    expect(pipe.transform(5, "JPY")).toBe("¥5");
  });

  it("sin DEFAULT_CURRENCY_CODE, USD (el default de Angular)", () => {
    expect(new CurrencyPipe("en-US").transform(1)).toBe("$1.00");
  });

  it("vacío da null y un valor que no es número es error, como en Angular", () => {
    const pipe = new CurrencyPipe("en-US", "USD");
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform("")).toBeNull();
    expect(pipe.transform("5")).toBe("$5.00");
    expect(() => pipe.transform("abc")).toThrowError(/is not a number/);
  });
});
