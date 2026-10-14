import { DEFAULT_CURRENCY_CODE } from "@/core/default-currency-code.ts";
import { Inject } from "@/core/di/inject.ts";
import { LOCALE_ID } from "@/core/locale-id.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { isEmptyNumber, parseDigitsInfo, strToNumber } from "@/pipes/number-format.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

type CurrencyDisplay = "code" | "symbol" | "symbol-narrow" | string | boolean;

/**
 * `CurrencyPipe` de Angular (`| currency: 'MXN': 'symbol': '1.0-0'`). Reemplaza al filtro `currency` de AngularJS,
 * cuyos argumentos eran símbolo y decimales: acá son código ISO (por defecto `DEFAULT_CURRENCY_CODE`), cómo mostrarlo
 * (`symbol`, `symbol-narrow`, `code` o un texto propio) y `digitsInfo` (por defecto, los decimales de la moneda).
 */
@Pipe({ name: "currency" })
export class CurrencyPipe implements PipeTransform<number | string | null | undefined, string | null> {
  constructor(
    @Inject(LOCALE_ID) private readonly locale: string,
    @Inject(DEFAULT_CURRENCY_CODE) private readonly defaultCurrencyCode: string = "USD",
  ) {}

  transform(
    value: number | string | null | undefined,
    currencyCode?: string,
    display: CurrencyDisplay = "symbol",
    digitsInfo?: string,
    locale?: string,
  ): string | null {
    if (isEmptyNumber(value)) return null;

    const num = strToNumber(value, "CurrencyPipe");
    const activeLocale = locale ?? this.locale;
    const base = { style: "currency", currency: currencyCode ?? this.defaultCurrencyCode } as const;
    const currencyDigits = new Intl.NumberFormat(activeLocale, base).resolvedOptions().maximumFractionDigits ?? 2;
    const digits = parseDigitsInfo(digitsInfo, {
      minimumIntegerDigits: 1,
      minimumFractionDigits: currencyDigits,
      maximumFractionDigits: currencyDigits,
    });

    // `true`/`false` son la forma vieja de Angular de decir `symbol`/`code`.
    const mode = display === true ? "symbol" : display === false ? "code" : display;
    const currencyDisplay = mode === "code" ? "code" : mode === "symbol-narrow" ? "narrowSymbol" : "symbol";
    const formatter = new Intl.NumberFormat(activeLocale, { ...base, currencyDisplay, ...digits });

    const isCustomSymbol = mode !== "code" && mode !== "symbol" && mode !== "symbol-narrow";
    if (!isCustomSymbol) return formatter.format(num);
    return formatter
      .formatToParts(num)
      .map((part) => (part.type === "currency" ? mode : part.value))
      .join("");
  }
}
