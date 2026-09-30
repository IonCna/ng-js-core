import { formatDate } from "@/common/i18n/format-date.ts";
import { Inject } from "@/core/di/inject.ts";
import { Optional } from "@/core/di/inject-flags.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { LOCALE_ID } from "@/core/platform/locale-id.ts";
import { invalidPipeArgument } from "@/pipes/invalid-pipe-argument.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/** Como `@angular/common`: el formato y la zona horaria por defecto de `DatePipe`. */
export interface DatePipeConfig {
  dateFormat?: string;
  timezone?: string;
}

/** Como `@angular/common`: `{ provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { dateFormat: "shortDate" } }`. */
export const DATE_PIPE_DEFAULT_OPTIONS = new InjectionToken<DatePipeConfig>("DATE_PIPE_DEFAULT_OPTIONS");

/**
 * `date` de `@angular/common` (reemplaza al filtro `date` de AngularJS; los formatos son los mismos, más los de
 * Angular). `{{ fecha | date:'shortDate':'UTC' }}`; por defecto `mediumDate`. Ver `formatDate`.
 */
@Pipe({ name: "date" })
export class DatePipe implements PipeTransform {
  constructor(
    @Inject(LOCALE_ID) private readonly locale: string,
    @Optional() @Inject(DATE_PIPE_DEFAULT_OPTIONS) private readonly defaultOptions?: DatePipeConfig | null,
  ) {}

  transform(value: Date | string | number | null | undefined, format?: string, timezone?: string, locale?: string): string | null {
    if (value == null || value === "" || value !== value) return null;
    try {
      const pattern = format ?? this.defaultOptions?.dateFormat ?? "mediumDate";
      const zone = timezone ?? this.defaultOptions?.timezone ?? undefined;
      return formatDate(value, pattern, locale || this.locale, zone);
    } catch (error) {
      throw invalidPipeArgument("DatePipe", error instanceof Error ? error.message : error);
    }
  }
}
