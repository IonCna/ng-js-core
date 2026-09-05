import type angular from "angular";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

/**
 * Cablea `@HostListener` contra el `$element` real de cada instancia, vía
 * `addEventListener` nativo (no `$element.on()` de jqLite — no hace falta,
 * ya tenemos el nodo crudo). No necesita ningún registro `tagName → Clase`:
 * en `onInstance` ya está la instancia construida, y `instance.constructor`
 * ES la clase — se lee `getComponentDef`/`getDirectiveDef` directo de ahí.
 */
export function decorateControllerHostListeners($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!instance) return;

      const $element = locals?.$element as { [i: number]: Element } | undefined;
      const nativeElement = $element?.[0];
      if (!nativeElement) return;

      const Clase = (instance as object).constructor as Function;
      const def = getComponentDef(Clase) ?? getDirectiveDef(Clase);

      for (const listener of def?.host?.listeners ?? []) {
        nativeElement.addEventListener(listener.eventName, (event) => {
          (instance as Record<string, (...args: unknown[]) => void>)[listener.methodName]?.(event);
        });
      }
    },
  });
}
decorateControllerHostListeners.$inject = ["$delegate"];
