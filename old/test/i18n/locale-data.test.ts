import { afterEach, describe, expect, it } from "vitest";
import { type LocaleData, registerLocaleData, ɵclearRegisteredLocales, ɵgetRegisteredLocale } from "@/i18n/index.ts";
import en from "@/i18n/locales/en.ts";
import esMX from "@/i18n/locales/es-MX.ts";

afterEach(() => ɵclearRegisteredLocales());

describe("etapa 18 — registerLocaleData", () => {
  it("deriva el id de `data.id`", () => {
    registerLocaleData(esMX);
    expect(ɵgetRegisteredLocale("es-mx")?.DATETIME_FORMATS?.MONTH).toBeDefined();
  });

  it("acepta un localeId explícito que pisa `data.id`", () => {
    registerLocaleData(esMX, "es-419");
    expect(ɵgetRegisteredLocale("es-419")).toBeDefined();
    expect(ɵgetRegisteredLocale("es-mx")).toBeUndefined();
  });

  it("normaliza `_` y mayúsculas (`es_MX` == `es-mx`)", () => {
    registerLocaleData(esMX, "es_MX");
    expect(ɵgetRegisteredLocale("ES-MX")).toBe(esMX);
  });

  it("cae al idioma base si no hay match exacto (`es-mx` → `es`)", () => {
    const base: LocaleData = { id: "es", NUMBER_FORMATS: { DECIMAL_SEP: "," } };
    registerLocaleData(base);
    expect(ɵgetRegisteredLocale("es-CO")).toBe(base);
  });

  it("overload de 2 args: objeto = extraData, se mergea sobre data", () => {
    registerLocaleData(en, { CUSTOM: 1 });
    expect(ɵgetRegisteredLocale("en")?.CUSTOM).toBe(1);
    expect(ɵgetRegisteredLocale("en")?.id).toBe("en");
  });

  it("extraData con los 3 args", () => {
    registerLocaleData(en, "en-CUSTOM", { CUSTOM: 2 });
    const data = ɵgetRegisteredLocale("en-custom");
    expect(data?.CUSTOM).toBe(2);
  });

  it("tira si no hay id por ningún lado", () => {
    expect(() => registerLocaleData({ NUMBER_FORMATS: {} })).toThrow(/localeId/);
  });
});

describe("etapa 18 — locales incluidos", () => {
  it("`en` — separadores US, meses en inglés, pluralCat one/other", () => {
    expect(en.NUMBER_FORMATS?.DECIMAL_SEP).toBe(".");
    expect(en.NUMBER_FORMATS?.GROUP_SEP).toBe(",");
    expect((en.DATETIME_FORMATS as { MONTH: string[] }).MONTH[0]).toBe("January");
    expect(en.pluralCat?.(1)).toBe("one");
    expect(en.pluralCat?.(2)).toBe("other");
  });

  it("`es-MX` — decimal `.`, miles `,`, moneda `$`, meses en español", () => {
    expect(esMX.id).toBe("es-mx");
    expect(esMX.NUMBER_FORMATS?.DECIMAL_SEP).toBe(".");
    expect(esMX.NUMBER_FORMATS?.GROUP_SEP).toBe(",");
    expect(esMX.NUMBER_FORMATS?.CURRENCY_SYM).toBe("$");
    expect((esMX.DATETIME_FORMATS as { MONTH: string[] }).MONTH[0]).toBe("enero");
  });
});
