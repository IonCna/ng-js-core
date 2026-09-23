import type { DirectiveDef } from "@/core/metadata/definitions.ts";

/**
 * Decorador de autoría para `@Directive`.
 *
 * La lectura de la definición y la emisión de `.directive()` pertenecen al
 * compilador. En runtime este decorador no debe registrar ni estampar nada.
 */
export function Directive(_def: DirectiveDef): ClassDecorator {
  return (target) => target;
}
