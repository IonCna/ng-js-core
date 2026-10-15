import { Inject } from "@/core/di/inject.ts";
import { LOCALE_ID } from "@/core/locale-id.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { formatDate } from "@/pipes/format-date.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/**
 * `DatePipe` de Angular (`| date: 'dd/MM/yyyy'`, `| date: 'short'`). Reemplaza al filtro `date` de AngularJS, que
 * formateaba con `$locale` (`en-us`) y no seguía al `LOCALE_ID`. Por defecto `'mediumDate'`, en la zona local.
 */
@Pipe({ name: "date" })
export class DatePipe implements PipeTransform<Date | string | number | null | undefined, string | null> {
  constructor(@Inject(LOCALE_ID) private readonly locale: string) {}

  transform(
    value: Date | string | number | null | undefined,
    format = "mediumDate",
    timezone?: string,
    locale?: string,
  ): string | null {
    if (value == null || value === "" || Number.isNaN(value)) return null;
    try {
      return formatDate(value, format, locale ?? this.locale, timezone);
    } catch (error) {
      throw new Error(
        `InvalidPipeArgument: '${error instanceof Error ? error.message : String(error)}' for pipe 'DatePipe'`,
      );
    }
  }
}
