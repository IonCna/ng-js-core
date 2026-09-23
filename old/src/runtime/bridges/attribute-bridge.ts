import type angular from "angular";
import { ATTRIBUTE_TOKEN_PREFIX } from "@/core/metadata/attribute.ts";
import { SelectorRegistry } from "@/core/metadata/selector-registry.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

/**
 * Agrega a `locals` una clave por cada `$attr:nombre` que aparezca en el
 * `$inject` de la clase (viene de `@Attribute`/`static $inject` a mano), con
 * el valor literal de `$attrs[nombre]`. Para saber qué clase es: si
 * `expression` (lo que `.directive()` pasa como `controller`) ya es la
 * función real, se usa directo — anda con selectores de atributo y con
 * varias directivas en el mismo elemento. Si no (el `expression` genérico
 * interno de `.component()`), cae a `SelectorRegistry` por tagName, que para
 * componentes es inequívoco (un solo componente por elemento).
 */
export function decorateControllerAttributes($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals, expression) => {
      const $element = locals?.$element as { [i: number]: Element } | undefined;
      const $attrs = locals?.$attrs as Record<string, string> | undefined;
      const tagName = $element?.[0]?.tagName;
      if (!tagName || !$attrs) return locals;

      const Clase = typeof expression === "function" ? expression : SelectorRegistry.getClass(tagName);
      const $inject = (Clase as unknown as { $inject?: readonly string[] } | undefined)?.$inject ?? [];

      let extra: Record<string, unknown> | undefined;
      for (const name of $inject) {
        if (name.startsWith(ATTRIBUTE_TOKEN_PREFIX)) {
          extra ??= {};
          extra[name] = $attrs[name.slice(ATTRIBUTE_TOKEN_PREFIX.length)];
        }
      }

      return extra ? { ...locals, ...extra } : locals;
    },
  });
}
decorateControllerAttributes.$inject = ["$delegate"];
