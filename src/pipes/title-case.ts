import { Pipe } from "@/core/metadata/pipe.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/** Sin filtro nativo en AngularJS (ver CONCEPTOS "Pipes") — mayúscula la primera letra de cada palabra. */
@Pipe({ name: "titlecase" })
export class TitleCasePipe implements PipeTransform<string | null | undefined, string> {
  transform(value?: string | null): string {
    if (value == null) return "";
    return String(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
}
