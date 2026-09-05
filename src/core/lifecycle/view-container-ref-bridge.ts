import type angular from "angular";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { ViewContainerRef, ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";
import { decorateControllerWith } from "@/core/lifecycle/shared.ts";

/** Clave de `$element.data()` bajo la que queda descubrible — mismo formato `$<nombre>Controller` que usa AngularJS nativo para cualquier directiva con nombre, así `ng-ref-read="viewContainerRef"` lo encuentra con el mismo mecanismo genérico (`ng-ref-bridge.ts`), sin casos especiales. */
export const VIEW_CONTAINER_REF_DATA_KEY = "$viewContainerRefController";

/**
 * Agrega `ViewContainerRef` a `locals` antes de instanciar — mismo mecanismo
 * que `element-ref-bridge.ts` (por-instancia, `augmentLocals`, no un
 * `.service()` de AngularJS). Necesita `$injector` real para que el
 * `ViewContainerRef` pueda resolver `$q`/`$compile`/etc. al usar
 * `createComponent`. También lo guarda en `$element.data()` — a diferencia
 * del reference (que solo lo expone vía el directive `<ng-container>`, con
 * `require`), acá cualquier elemento con controller lo tiene, sin necesitar
 * ese directive aparte.
 */
export function decorateControllerViewContainerRef(
  $delegate: angular.IControllerService,
  $injector: angular.auto.IInjectorService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $element = locals?.$element as (angular.IAugmentedJQuery & { [i: number]: Element }) | undefined;
      const nativeElement = $element?.[0];
      if (!nativeElement || (locals && Object.hasOwn(locals, ViewContainerRef.$name))) return locals;

      const elementRef = new ElementRefImpl(nativeElement as HTMLElement);
      const viewContainerRef = new ViewContainerRefImpl(elementRef, $injector);
      $element.data(VIEW_CONTAINER_REF_DATA_KEY, viewContainerRef);

      return { ...locals, [ViewContainerRef.$name]: viewContainerRef };
    },
  });
}
decorateControllerViewContainerRef.$inject = ["$delegate", "$injector"];
