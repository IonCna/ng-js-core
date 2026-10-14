import { Pipe } from "@/core/metadata/pipe.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/** Una palabra es una racha de letras o dígitos Unicode, como en Angular: `\w` es solo ASCII y rompía `álvaro`. */
const UNICODE_WORD = /[\p{L}\p{N}]+/gu;

/** Sin filtro nativo en AngularJS (ver CONCEPTOS "Pipes") — mayúscula la primera letra de cada palabra. */
@Pipe({ name: "titlecase" })
export class TitleCasePipe implements PipeTransform<string | null | undefined, string> {
  transform(value?: string | null): string {
    if (value == null) return "";
    return String(value).replace(UNICODE_WORD, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
}
