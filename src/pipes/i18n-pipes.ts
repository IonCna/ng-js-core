import { ɵfindLocaleData } from "@/common/i18n/locale-data.ts";
import { Inject } from "@/core/di/inject.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { LOCALE_ID } from "@/core/platform/locale-id.ts";
import { invalidPipeArgument } from "@/pipes/invalid-pipe-argument.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/**
 * `i18nPlural` de `@angular/common`: `{{ n | i18nPlural:{ '=0': 'nada', 'one': 'un item', 'other': '# items' } }}`.
 * Primero `=n` exacto, después la categoría plural del locale (`pluralCat` del `$locale`), después `other`.
 */
@Pipe({ name: "i18nPlural" })
export class I18nPluralPipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private readonly locale: string) {}

  transform(value: number | null | undefined, pluralMap: Record<string, string>, locale?: string): string {
    if (value == null) return "";
    if (typeof pluralMap !== "object" || pluralMap === null) throw invalidPipeArgument("I18nPluralPipe", pluralMap);
    const cases = Object.keys(pluralMap);
    let key = `=${value}`;
    if (!cases.includes(key)) {
      const category = ɵfindLocaleData(locale || this.locale).pluralCat?.(value) ?? "other";
      if (cases.includes(category)) key = category;
      else if (cases.includes("other")) key = "other";
      else throw new Error(`No plural message found for value "${value}"`);
    }
    return pluralMap[key]!.replace(/#/, value.toString());
  }
}

/** `i18nSelect` de `@angular/common`: `{{ genero | i18nSelect:{ male: 'él', female: 'ella', other: 'elle' } }}`. */
@Pipe({ name: "i18nSelect" })
export class I18nSelectPipe implements PipeTransform {
  transform(value: string | null | undefined, mapping: Record<string, string>): string {
    if (value == null) return "";
    if (typeof mapping !== "object" || typeof value !== "string") throw invalidPipeArgument("I18nSelectPipe", mapping);
    if (Object.hasOwn(mapping, value)) return mapping[value]!;
    if (Object.hasOwn(mapping, "other")) return mapping.other!;
    return "";
  }
}
