import { formatCurrency, formatNumber, formatPercent, getCurrencySymbol } from "@/common/i18n/format-number.ts";
import { Inject } from "@/core/di/inject.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { DEFAULT_CURRENCY_CODE } from "@/core/platform/default-currency-code.ts";
import { LOCALE_ID } from "@/core/platform/locale-id.ts";
import { invalidPipeArgument, isValue, strToNumber } from "@/pipes/invalid-pipe-argument.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/**
 * `number` de `@angular/common` (reemplaza al filtro `number` de AngularJS): `{{ x | number:'1.2-2' }}`, con
 * `digitsInfo` como Angular (`"{minInt}.{minFrac}-{maxFrac}"`, por defecto `"1.0-3"`).
 */
@Pipe({ name: "number" })
export class DecimalPipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private readonly locale: string) {}

  transform(value: number | string | null | undefined, digitsInfo?: string, locale?: string): string | null {
    if (!isValue(value)) return null;
    try {
      return formatNumber(strToNumber(value as number | string), locale || this.locale, digitsInfo);
    } catch (error) {
      throw invalidPipeArgument("DecimalPipe", error instanceof Error ? error.message : error);
    }
  }
}

/** `percent` de `@angular/common`: `{{ 0.25 | percent }}` → `25%`; `digitsInfo` por defecto `"1.0-0"`. */
@Pipe({ name: "percent" })
export class PercentPipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private readonly locale: string) {}

  transform(value: number | string | null | undefined, digitsInfo?: string, locale?: string): string | null {
    if (!isValue(value)) return null;
    try {
      return formatPercent(strToNumber(value as number | string), locale || this.locale, digitsInfo);
    } catch (error) {
      throw invalidPipeArgument("PercentPipe", error instanceof Error ? error.message : error);
    }
  }
}

/**
 * `currency` de `@angular/common` (reemplaza al filtro `currency` de AngularJS): `{{ x | currency:'EUR':'symbol':'1.0-0' }}`.
 * Sin código, `DEFAULT_CURRENCY_CODE` (`"USD"`); `display`: `'symbol'` (default), `'symbol-narrow'`, `'code'` o un texto.
 */
@Pipe({ name: "currency" })
export class CurrencyPipe implements PipeTransform {
  constructor(
    @Inject(LOCALE_ID) private readonly locale: string,
    @Inject(DEFAULT_CURRENCY_CODE) private readonly defaultCurrencyCode = "USD",
  ) {}

  transform(
    value: number | string | null | undefined,
    currencyCode: string = this.defaultCurrencyCode,
    display: "code" | "symbol" | "symbol-narrow" | string | boolean = "symbol",
    digitsInfo?: string,
    locale?: string,
  ): string | null {
    if (!isValue(value)) return null;
    const resolvedLocale = locale || this.locale;
    const mode = typeof display === "boolean" ? (display ? "symbol" : "code") : display;
    let currency = currencyCode || this.defaultCurrencyCode;
    if (mode !== "code") {
      currency = mode === "symbol" || mode === "symbol-narrow" ? getCurrencySymbol(currency, mode === "symbol" ? "wide" : "narrow", resolvedLocale) : mode;
    }
    try {
      return formatCurrency(strToNumber(value as number | string), resolvedLocale, currency, currencyCode, digitsInfo);
    } catch (error) {
      throw invalidPipeArgument("CurrencyPipe", error instanceof Error ? error.message : error);
    }
  }
}
