import { Inject } from "@/core/di/inject.ts";
import { LOCALE_ID } from "@/core/locale-id.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/**
 * `I18nPluralPipe` de Angular: elige el mensaje según el número (`=0`, `=1`, … y después la categoría plural del
 * `LOCALE_ID`: `one`, `few`, `many`, `other`) y reemplaza `#` por el número.
 * `{{ n | i18nPlural: { '=0': 'Sin pedidos', one: '# pedido', other: '# pedidos' } }}`.
 */
@Pipe({ name: "i18nPlural" })
export class I18nPluralPipe implements PipeTransform<number | null | undefined, string> {
  constructor(@Inject(LOCALE_ID) private readonly locale: string) {}

  transform(value: number | null | undefined, pluralMap: Record<string, string>, locale?: string): string {
    if (value == null) return "";
    if (typeof pluralMap !== "object" || pluralMap === null) {
      throw new Error(`InvalidPipeArgument: '${String(pluralMap)}' for pipe 'I18nPluralPipe'`);
    }

    const exact = `=${value}`;
    const category = new Intl.PluralRules(locale ?? this.locale).select(value);
    const key = Object.hasOwn(pluralMap, exact) ? exact : Object.hasOwn(pluralMap, category) ? category : "other";
    const message = pluralMap[key];
    if (message === undefined) throw new Error(`No plural message found for value "${value}"`);
    return message.replace(/#/g, value.toString());
  }
}
