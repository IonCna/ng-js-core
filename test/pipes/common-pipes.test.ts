import { afterEach, describe, expect, it } from "vitest";
import { formatDate } from "@/common/i18n/format-date.ts";
import { formatCurrency, formatNumber, formatPercent, getCurrencySymbol } from "@/common/i18n/format-number.ts";
import { registerLocaleData, ɵclearRegisteredLocales } from "@/i18n/locale-data.ts";
import esMX from "@/i18n/locales/es-MX.ts";
import {
  CurrencyPipe,
  DatePipe,
  DecimalPipe,
  I18nPluralPipe,
  I18nSelectPipe,
  JsonPipe,
  LowerCasePipe,
  PercentPipe,
  SlicePipe,
  TitleCasePipe,
  UpperCasePipe,
} from "@/pipes/index.ts";

/** Los pipes de `@angular/common` con su semántica (y las funciones `format*`), sobre los datos del `$locale`. */
describe("pipes de @angular/common (unidad, sin AngularJS)", () => {
  afterEach(() => ɵclearRegisteredLocales());

  // 2015-06-15 09:03:01.550 UTC, un lunes.
  const date = new Date(Date.UTC(2015, 5, 15, 9, 3, 1, 550));

  describe("formatDate / DatePipe", () => {
    it("formatos con nombre y patrones de Angular (en-US por defecto, con zona horaria)", () => {
      expect(formatDate(date, "shortDate", "en-US", "UTC")).toBe("6/15/15");
      expect(formatDate(date, "mediumDate", "en-US", "UTC")).toBe("Jun 15, 2015");
      expect(formatDate(date, "fullDate", "en-US", "UTC")).toBe("Monday, June 15, 2015");
      expect(formatDate(date, "shortTime", "en-US", "UTC")).toBe("9:03 AM");
      expect(formatDate(date, "longTime", "en-US", "UTC")).toBe("9:03:01 AM GMT+0");
      expect(formatDate(date, "yyyy-MM-dd HH:mm:ss.SSS", "en-US", "UTC")).toBe("2015-06-15 09:03:01.550");
      expect(formatDate(date, "EEEE d 'de' MMMM, y (EEE, EEEEE, MMMMM)", "en-US", "UTC")).toBe("Monday 15 de June, 2015 (Mon, M, J)");
      expect(formatDate(date, "h:mm a Z ZZZZZ OOOO", "en-US", "+0430")).toBe("1:33 PM +0430 +04:30 GMT+04:30");
      expect(formatDate(date, "w ww W Y G GGGG", "en-US", "UTC")).toBe("25 25 3 2015 AD Anno Domini");
      expect(formatDate(date, "''yy''", "en-US", "UTC")).toBe("'15'");
      // `sss`: los milisegundos de AngularJS (`input[type=datetime-local]`).
      expect(formatDate(date, "yyyy-MM-ddTHH:mm:ss.sss", "en-US", "UTC")).toBe("2015-06-15T09:03:01.550");
    });

    it("acepta números, strings numéricos, ISO y 'yyyy-MM-dd' (fecha local); lo demás es error", () => {
      expect(formatDate(date.getTime(), "yyyy", "en-US", "UTC")).toBe("2015");
      expect(formatDate(String(date.getTime()), "yyyy", "en-US", "UTC")).toBe("2015");
      expect(formatDate("2015-06-15T09:03:01Z", "HH:mm", "en-US", "UTC")).toBe("09:03");
      expect(formatDate("2015-06-15", "d/M/yyyy HH:mm", "en-US")).toBe("15/6/2015 00:00");
      expect(() => formatDate("mañana", "yyyy", "en-US")).toThrow('Unable to convert "mañana" into a date');
    });

    it("usa los datos registrados con registerLocaleData; sin datos del locale es error", () => {
      registerLocaleData(esMX, "es-MX");
      expect(formatDate(date, "EEEE d 'de' MMMM", "es-MX", "UTC")).toBe("lunes 15 de junio");
      expect(() => formatDate(date, "yyyy", "fr")).toThrow('Missing locale data for the locale "fr"');
    });

    it("DatePipe: null/''/NaN → null, mediumDate por defecto, DATE_PIPE_DEFAULT_OPTIONS y error de Angular", () => {
      const pipe = new DatePipe("en-US");
      expect(pipe.transform(null)).toBeNull();
      expect(pipe.transform("")).toBeNull();
      expect(pipe.transform(date, undefined, "UTC")).toBe("Jun 15, 2015");
      expect(new DatePipe("en-US", { dateFormat: "yyyy", timezone: "UTC" }).transform(date)).toBe("2015");
      expect(() => pipe.transform("nada")).toThrow("NG02100: InvalidPipeArgument");
    });
  });

  describe("formatNumber / DecimalPipe / PercentPipe / CurrencyPipe", () => {
    it("digitsInfo como Angular (1.0-3 por defecto), redondeo sin errores de punto flotante y agrupación del locale", () => {
      expect(formatNumber(1234.5678, "en-US")).toBe("1,234.568");
      expect(formatNumber(3.14159, "en-US", "3.1-2")).toBe("003.14");
      expect(formatNumber(1.005, "en-US", "1.2-2")).toBe("1.01");
      expect(formatNumber(-0.0001, "en-US")).toBe("0");
      expect(formatNumber(2, "en-US", "1.2")).toBe("2.00");
      expect(() => formatNumber(1, "en-US", "1.x")).toThrow("1.x is not a valid digit info");
      registerLocaleData(esMX, "es-MX");
      expect(formatNumber(1234.5, "es-MX", "1.2-2")).toBe("1,234.50");
    });

    it("formatPercent y formatCurrency (decimales por moneda, símbolo del patrón del locale)", () => {
      expect(formatPercent(0.25, "en-US")).toBe("25%");
      expect(formatPercent(0.1234, "en-US", "1.2-2")).toBe("12.34%");
      expect(formatCurrency(1234.5, "en-US", "$", "USD")).toBe("$1,234.50");
      expect(formatCurrency(-5, "en-US", "¥", "JPY")).toBe("-¥5");
      expect(getCurrencySymbol("EUR", "wide", "en-US")).toBe("€");
      expect(getCurrencySymbol("CAD", "wide", "en-US")).toBe("CA$");
      expect(getCurrencySymbol("CAD", "narrow", "en-US")).toBe("$");
    });

    it("los pipes: null/''/NaN → null, strings numéricos, y un no-número es error de Angular", () => {
      expect(new DecimalPipe("en-US").transform("1234.5", "1.1-1")).toBe("1,234.5");
      expect(new DecimalPipe("en-US").transform(null)).toBeNull();
      expect(() => new DecimalPipe("en-US").transform("abc")).toThrow("NG02100: InvalidPipeArgument: 'abc is not a number' for pipe 'DecimalPipe'");
      expect(new PercentPipe("en-US").transform("0.5")).toBe("50%");
      expect(new PercentPipe("en-US").transform("")).toBeNull();
      const currency = new CurrencyPipe("en-US", "USD");
      expect(currency.transform(0.5)).toBe("$0.50");
      expect(currency.transform(1000, "EUR", "code", "1.0-0")).toBe("EUR1,000");
      expect(currency.transform(1, "CAD", "symbol-narrow")).toBe("$1.00");
      expect(currency.transform(1, "USD", "US$ ")).toBe("US$ 1.00");
      expect(new CurrencyPipe("en-US", "EUR").transform(2)).toBe("€2.00");
    });
  });

  describe("texto e i18n", () => {
    it("uppercase / lowercase / titlecase: null → null, un no-string es error", () => {
      expect(new UpperCasePipe().transform("hola")).toBe("HOLA");
      expect(new LowerCasePipe().transform("HOLA")).toBe("hola");
      expect(new TitleCasePipe().transform("hello WORLD")).toBe("Hello World");
      expect(new UpperCasePipe().transform(null)).toBeNull();
      expect(() => new LowerCasePipe().transform(3 as unknown as string)).toThrow("InvalidPipeArgument: '3' for pipe 'LowerCasePipe'");
    });

    it("json (indentado a 2) y slice (array o string, null → null)", () => {
      expect(new JsonPipe().transform({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}');
      expect(new SlicePipe().transform([1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
      expect(new SlicePipe().transform("abcdef", -2)).toBe("ef");
      expect(new SlicePipe().transform(null, 1)).toBeNull();
    });

    it("i18nPlural (=n, categoría del locale, other, '#') e i18nSelect", () => {
      const plural = new I18nPluralPipe("en-US");
      const map = { "=0": "nada", one: "un item", other: "# items" };
      expect(plural.transform(0, map)).toBe("nada");
      expect(plural.transform(1, map)).toBe("un item");
      expect(plural.transform(5, map)).toBe("5 items");
      expect(plural.transform(null, map)).toBe("");
      expect(() => plural.transform(2, { one: "x" })).toThrow('No plural message found for value "2"');
      const select = new I18nSelectPipe();
      expect(select.transform("female", { male: "él", female: "ella", other: "elle" })).toBe("ella");
      expect(select.transform("x", { male: "él", other: "elle" })).toBe("elle");
      expect(select.transform("x", { male: "él" })).toBe("");
    });
  });
});
