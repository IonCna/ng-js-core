import { Pipe } from "@/core/metadata/pipe.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/**
 * `I18nSelectPipe` de Angular: el texto que corresponde a un valor, o el de `other`.
 * `{{ estado | i18nSelect: { pending: 'Pendiente', other: 'Sin estado' } }}`.
 */
@Pipe({ name: "i18nSelect" })
export class I18nSelectPipe implements PipeTransform<string | null | undefined, string> {
  transform(value: string | null | undefined, mapping: Record<string, string>): string {
    if (value == null) return "";
    if (typeof mapping !== "object" || mapping === null || typeof value !== "string") {
      throw new Error(`InvalidPipeArgument: '${String(mapping)}' for pipe 'I18nSelectPipe'`);
    }
    if (Object.hasOwn(mapping, value)) return mapping[value] ?? "";
    return mapping["other"] ?? "";
  }
}
