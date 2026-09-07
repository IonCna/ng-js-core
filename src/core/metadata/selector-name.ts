/**
 * `selector → nombre de registro AngularJS` (camelCase). Un `[attr]` pierde los
 * corchetes; `mi-cosa` y `[miCosa]` caen los dos en `miCosa`. Es la MISMA clave
 * con la que `registerDeclaration`/`createComponent` registran la directiva, y
 * ahora también el `id` inyectable de la clase `@Component`/`@Directive` (para
 * que un descendiente pueda `inject(MiCosa)` y reciba la instancia ancestro).
 */
export function stripAttributeSelector(selector: string): string {
  return selector.startsWith("[") && selector.endsWith("]") ? selector.slice(1, -1) : selector;
}

export function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

export function selectorToRegistrationName(selector: string): string {
  return toCamelCase(stripAttributeSelector(selector));
}
