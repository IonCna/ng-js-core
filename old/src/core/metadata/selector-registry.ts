/**
 * `tagName → Clase`. Hace falta porque `.component()` invoca `$controller`
 * con `expression: "controller"` (un string genérico interno, no la clase
 * real — confirmado con un probe real) y `later: true`, así que no hay forma
 * de saber "esta instancia es de tal clase" antes de construirla más que
 * mirando el `$element` (`$element[0].tagName` da el selector real, ej.
 * `"MY-WIDGET"`).
 *
 * `WeakMap` no sirve acá: sus keys tienen que ser objetos, y `tagName` es un
 * string — por eso `Map` normal.
 */
export class SelectorRegistry {
  private static readonly registry = new Map<string, Function>();

  static register(selector: string, Clase: Function): void {
    SelectorRegistry.registry.set(selector.toUpperCase(), Clase);
  }

  static getClass(tagName: string): Function | undefined {
    return SelectorRegistry.registry.get(tagName.toUpperCase());
  }
}
