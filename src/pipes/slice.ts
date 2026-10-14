import { Pipe } from "@/core/metadata/pipe.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";

function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * `SlicePipe` de Angular: un pedazo de un arreglo o de un string, como `Array.prototype.slice`. `pure: false` como
 * en Angular (ve los cambios dentro del mismo arreglo). Como el filtro se evalúa en cada digest, guarda el último
 * resultado de cada arreglo y rango: si los elementos no cambiaron devuelve la misma referencia, para que un binding
 * por identidad no entre en loop de digest (ver `KeyValuePipe`).
 */
@Pipe({ name: "slice", pure: false })
export class SlicePipe implements PipeTransform<readonly unknown[] | string | null | undefined, unknown> {
  private readonly cache = new WeakMap<readonly unknown[], Map<string, readonly unknown[]>>();

  transform<T>(
    value: readonly T[] | string | null | undefined,
    start: number,
    end?: number,
  ): readonly T[] | string | null {
    if (value == null) return null;
    if (typeof value === "string") return value.slice(start, end);
    if (!Array.isArray(value)) throw new Error(`InvalidPipeArgument: '${String(value)}' for pipe 'SlicePipe'`);

    const result = value.slice(start, end);
    let byRange = this.cache.get(value);
    if (!byRange) {
      byRange = new Map();
      this.cache.set(value, byRange);
    }
    const key = `${start}:${end}`;
    const cached = byRange.get(key);
    if (cached && sameItems(cached, result)) return cached as readonly T[];

    byRange.set(key, result);
    return result;
  }
}
