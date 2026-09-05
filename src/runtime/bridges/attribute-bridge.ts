import type angular from "angular";
import { ATTRIBUTE_TOKEN_PREFIX } from "@/core/metadata/attribute.ts";
import { SelectorRegistry } from "@/core/metadata/selector-registry.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

/**
 * Agrega a `locals` una clave por cada `$attr:nombre` que aparezca en el
 * `$inject` de la clase (viene de `@Attribute`/`static $inject` a mano), con
 * el valor literal de `$attrs[nombre]`. Necesita `SelectorRegistry` para
 * saber qué clase es — mismo problema que el resto de las piezas de esta
 * etapa: `.component()` no da la clase real en `$controller`.
 */
export function decorateControllerAttributes($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $element = locals?.$element as { [i: number]: Element } | undefined;
      const $attrs = locals?.$attrs as Record<string, string> | undefined;
      const tagName = $element?.[0]?.tagName;
      if (!tagName || !$attrs) return locals;

      const Clase = SelectorRegistry.getClass(tagName);
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
