import { setInjectOverride } from "@/core/di/injectable.ts";

/**
 * Prefijo del token sintético que marca "este parámetro viene de `$attrs`,
 * no de DI". `$attr:type` nunca choca con un nombre de servicio real, así que
 * el bridge (`attribute-bridge.ts`) lo distingue sin ambigüedad al armar los
 * locals. Un consumidor JS puro puede escribir esto directo, sin decorador:
 * `static $inject = ["$attr:type"]`.
 */
export const ATTRIBUTE_TOKEN_PREFIX = "$attr:";

/**
 * Decorador de parámetro — el valor **literal** de un atributo HTML (sin
 * bindeo, se resuelve una sola vez). En AngularJS es `$attrs.nombre`. Mismo
 * mecanismo que `@Inject`: solo anota, el valor real lo pone el bridge
 * (`attribute-bridge.ts`, etapa 5) agregando el token sintético a los locals
 * antes de que `$injector` resuelva el ctor.
 */
export function Attribute(name: string): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    setInjectOverride(target as unknown as Function, parameterIndex, `${ATTRIBUTE_TOKEN_PREFIX}${name}`);
  };
}
