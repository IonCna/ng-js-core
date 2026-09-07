import type angular from "angular";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

function classTokens(value: unknown): string[] {
  return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [];
}

function applyHostBinding(el: Element, hostProperty: string, value: unknown, oldValue?: unknown): void {
  if (hostProperty === "class") {
    // `@HostBinding('class')` — string entera. Saca los tokens viejos que ya no
    // están y agrega los nuevos; no toca las clases estáticas del template.
    const next = classTokens(value);
    for (const token of classTokens(oldValue)) if (!next.includes(token)) el.classList.remove(token);
    for (const token of next) el.classList.add(token);
    return;
  }
  if (hostProperty.startsWith("class.")) {
    el.classList.toggle(hostProperty.slice("class.".length), !!value);
    return;
  }
  if (hostProperty.startsWith("style.")) {
    (el as HTMLElement).style.setProperty(hostProperty.slice("style.".length), value == null ? "" : String(value));
    return;
  }
  if (hostProperty.startsWith("attr.")) {
    // Como Angular real: solo `null`/`undefined` borra el atributo. Todo lo
    // demás se stringifica tal cual, incluido `false` → `"false"` — clave
    // para ARIA (`aria-expanded="false"` no es lo mismo que sacar el atributo).
    const attr = hostProperty.slice("attr.".length);
    if (value == null) el.removeAttribute(attr);
    else el.setAttribute(attr, String(value));
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
          (value, oldValue) => applyHostBinding(nativeElement, binding.hostProperty, value, oldValue),
        ),
      );

      $scope.$on("$destroy", () => {
        for (const deregister of deregisterFns) deregister();
      });
    },
  });
}
decorateControllerHostBindings.$inject = ["$delegate"];
