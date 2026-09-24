import type { PipeDef } from "@/core/metadata/definitions.ts";

export type { PipeTransform } from "@/pipes/pipe-transform.ts";

/**
 * Decorador de autoría para `@Pipe`.
 *
 * `ng-js-compiler` lee la definición y genera `ɵpipe` más el `.filter()` de
 * AngularJS. El decorador no registra ni crea instancias en runtime.
 */
export function Pipe(_def: PipeDef): ClassDecorator {
  return (target) => target;
}
