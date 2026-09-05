import type { QueryToken } from "@/core/queries/query-types.ts";

/**
 * La propia clase del controller Y todas sus ancestras (subiendo la cadena
 * de `prototype`) — así `viewChild(BaseComponente)` matchea también una
 * instancia de una subclase suya. Publicado automáticamente por cada
 * controller al construirse, sin necesitar ninguna anotación (ver
 * `ng-ref-bridge.ts`).
 */
export function getControllerTokens(controller: object): readonly QueryToken<unknown>[] {
  const tokens: QueryToken<unknown>[] = [];
  let prototype: object | null = Object.getPrototypeOf(controller);

  while (prototype && prototype !== Object.prototype) {
    const ctor = prototype.constructor as QueryToken<unknown> | undefined;
    if (ctor && !tokens.includes(ctor)) tokens.push(ctor);
    prototype = Object.getPrototypeOf(prototype);
  }

  return tokens;
}
