import { Pipe } from "@/core/metadata/pipe.ts";
import { invalidPipeArgument } from "@/pipes/invalid-pipe-argument.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

/** `uppercase` de `@angular/common`. */
@Pipe({ name: "uppercase" })
export class UpperCasePipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value !== "string") throw invalidPipeArgument("UpperCasePipe", value);
    return value.toUpperCase();
  }
}

/** `lowercase` de `@angular/common`. */
@Pipe({ name: "lowercase" })
export class LowerCasePipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value !== "string") throw invalidPipeArgument("LowerCasePipe", value);
    return value.toLowerCase();
  }
}

/** `titlecase` de `@angular/common`: la primera letra de cada palabra en mayúscula, el resto en minúscula. */
@Pipe({ name: "titlecase" })
export class TitleCasePipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value !== "string") throw invalidPipeArgument("TitleCasePipe", value);
    return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
}

/** `json` de `@angular/common` (impuro, como Angular: el objeto puede mutar sin cambiar de referencia). */
@Pipe({ name: "json", pure: false })
export class JsonPipe implements PipeTransform {
  transform(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}

/** `slice` de `@angular/common` (impuro, como Angular): `{{ items | slice:1:3 }}` sobre un array o un string. */
@Pipe({ name: "slice", pure: false })
export class SlicePipe implements PipeTransform {
  transform<T>(value: ReadonlyArray<T> | string | null | undefined, start: number, end?: number): Array<T> | string | null {
    if (value == null) return null;
    if (typeof value !== "string" && !Array.isArray(value)) throw invalidPipeArgument("SlicePipe", value);
    return value.slice(start, end) as Array<T> | string;
  }
}
