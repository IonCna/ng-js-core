import { Inject } from "@/core/di/inject.ts";
import { LOCALE_ID } from "@/core/locale-id.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { isEmptyNumber, parseDigitsInfo, strToNumber } from "@/pipes/number-format.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/**
 * `DecimalPipe` de Angular (`| number: '1.0-2'`). Reemplaza al filtro `number` de AngularJS, cuyo argumento era la
 * cantidad de decimales (`number: 2`): acá es un `digitsInfo`, y por defecto `"1.0-3"`.
 */
@Pipe({ name: "number" })
export class DecimalPipe implements PipeTransform<number | string | null | undefined, string | null> {
  constructor(@Inject(LOCALE_ID) private readonly locale: string) {}

  transform(value: number | string | null | undefined, digitsInfo?: string, locale?: string): string | null {
    if (isEmptyNumber(value)) return null;

    const num = strToNumber(value, "DecimalPipe");
    const digits = parseDigitsInfo(digitsInfo, {
      minimumIntegerDigits: 1,
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
    return new Intl.NumberFormat(locale ?? this.locale, digits).format(num);
  }
}
