import { Inject } from "@/core/di/inject.ts";
import { LOCALE_ID } from "@/core/locale-id.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { isEmptyNumber, parseDigitsInfo, strToNumber } from "@/pipes/number-format.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/** `PercentPipe` de Angular: `value * 100` + `"%"` con el formato del `LOCALE_ID`; `digitsInfo` por defecto `"1.0-0"`. */
@Pipe({ name: "percent" })
export class PercentPipe implements PipeTransform<number | string | null | undefined, string | null> {
  constructor(@Inject(LOCALE_ID) private readonly locale: string) {}

  transform(value: number | string | null | undefined, digitsInfo?: string, locale?: string): string | null {
    if (isEmptyNumber(value)) return null;

    const num = strToNumber(value, "PercentPipe");
    const digits = parseDigitsInfo(digitsInfo, {
      minimumIntegerDigits: 1,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return new Intl.NumberFormat(locale ?? this.locale, { style: "percent", ...digits }).format(num);
  }
}
