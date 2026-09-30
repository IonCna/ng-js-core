import type angular from "angular";
import { currentInjector } from "@/core/di/injector.ts";
import { type LocaleData, ɵgetRegisteredLocale } from "@/i18n/locale-data.ts";
import en from "@/i18n/locales/en.ts";

/** Un patrón de número de `$locale.NUMBER_FORMATS.PATTERNS` (decimal `[0]`, moneda `[1]`). */
export interface NumberPattern {
  gSize: number;
  lgSize: number;
  maxFrac: number;
  minFrac: number;
  minInt: number;
  negPre: string;
  negSuf: string;
  posPre: string;
  posSuf: string;
}

export interface DateTimeFormats {
  AMPMS: string[];
  DAY: string[];
  SHORTDAY: string[];
  MONTH: string[];
  SHORTMONTH: string[];
  STANDALONEMONTH?: string[];
  ERAS: string[];
  ERANAMES: string[];
  [format: string]: unknown;
}

export interface NumberFormats {
  DECIMAL_SEP: string;
  GROUP_SEP: string;
  PATTERNS: NumberPattern[];
}

const normalize = (id: string) => id.toLowerCase().replace(/_/g, "-");

/**
 * Los datos de un locale para los pipes y las funciones `format*` de `@angular/common`. En ngjs son el `$locale` de
 * AngularJS: el registrado con `registerLocaleData`, el `$locale` vivo de la app si es ese idioma (p. ej. el de un
 * `angular-locale_xx.js`), o el `en` que trae AngularJS por defecto (el `"en-US"` de Angular). Sin datos es error,
 * como Angular (`Missing locale data`).
 */
export function ɵfindLocaleData(locale: string): LocaleData {
  const registered = ɵgetRegisteredLocale(locale);
  if (registered) return registered;

  const live = currentInjector()?.get<angular.ILocaleService | null>("$locale", null) as LocaleData | null | undefined;
  const id = normalize(locale);
  if (live?.id && [id, id.split("-")[0]].includes(normalize(live.id))) return live;
  if (id === "en" || id.startsWith("en-")) return en;

  throw new Error(`Missing locale data for the locale "${locale}" — registralo con registerLocaleData().`);
}

export function ɵdateTimeFormats(locale: string): DateTimeFormats {
  return ɵfindLocaleData(locale).DATETIME_FORMATS as unknown as DateTimeFormats;
}

export function ɵnumberFormats(locale: string): NumberFormats {
  return ɵfindLocaleData(locale).NUMBER_FORMATS as unknown as NumberFormats;
}
