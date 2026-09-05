import type angular from "angular";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

function applyHostBinding(el: Element, hostProperty: string, value: unknown): void {
  if (hostProperty.startsWith("class.")) {
    el.classList.toggle(hostProperty.slice("class.".length), !!value);
    return;
  }
  if (hostProperty.startsWith("style.")) {
    (el as HTMLElement).style.setProperty(hostProperty.slice("style.".length), value == null ? "" : String(value));
    return;
  }
  if (hostProperty.startsWith("attr.")) {
    const attr = hostProperty.slice("attr.".length);
    if (value == null || value === false) el.removeAttribute(attr);
    else el.setAttribute(attr, value === true ? "" : String(value));
    return;
  }
  // propiedad DOM plana (id, title, hidden, ...)
  (el as unknown as Record<string, unknown>)[hostProperty] = value;
}

/**
 * Cablea `@HostBinding` contra el `$element` real de cada instancia, vía
 * `$scope.$watch` — a diferencia de `@HostListener` (engancha una vez),
 * necesita reaccionar cada vez que la propiedad cambia, y `$watch` es lo
 * mismo que ya usa todo lo demás (nada de detección de cambios propia).
 * Cada watch se desregistra en `$destroy` — si no, en un `.directive()` con
 * scope compartido (no aislado) se acumularían para siempre.
 */
export function decorateControllerHostBindings($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!instance) return;

      const $element = locals?.$element as { [i: number]: Element } | undefined;
      const nativeElement = $element?.[0];
      const $scope = locals?.$scope as angular.IScope | undefined;
      if (!nativeElement || !$scope) return;

      const Clase = (instance as object).constructor as Function;
      const def = getComponentDef(Clase) ?? getDirectiveDef(Clase);
      const bindings = def?.host?.bindings ?? [];
      if (bindings.length === 0) return;

      const deregisterFns = bindings.map((binding) =>
        $scope.$watch(
          () => (instance as Record<string, unknown>)[binding.propName],
          (value) => applyHostBinding(nativeElement, binding.hostProperty, value),
        ),
      );

      $scope.$on("$destroy", () => {
        for (const deregister of deregisterFns) deregister();
      });
    },
  });
}
decorateControllerHostBindings.$inject = ["$delegate"];
