import type { ComponentDef } from "@/core/metadata/definitions.ts";

/**
 * Decorador de autoría para `@Component`.
 *
 * El decorador solo mantiene la forma pública que consume el compilador. No
 * escribe metadata en la clase ni registra nada en AngularJS: `ng-js-compiler`
 * lee el decorador durante el build y genera `ɵfac`, `ɵcmp` y `.component()`.
 */
export function Component(_def: ComponentDef): ClassDecorator {
  return (target) => target;
}
