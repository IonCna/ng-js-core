import type angular from "angular";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { ViewContainerRef, ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";
import { decorateControllerWith } from "@/core/lifecycle/shared.ts";

/**
 * Agrega `ViewContainerRef` a `locals` antes de instanciar — mismo mecanismo
 * que `element-ref-bridge.ts` (por-instancia, `augmentLocals`, no un
 * `.service()` de AngularJS). Necesita `$injector` real para que el
 * `ViewContainerRef` pueda resolver `$q`/`$compile`/etc. al usar
 * `createComponent`.
 */
export function decorateControllerViewContainerRef(
  $delegate: angular.IControllerService,
  $injector: angular.auto.IInjectorService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $element = locals?.$element as { [i: number]: Element } | undefined;
      const nativeElement = $element?.[0];
      if (!nativeElement || (locals && Object.hasOwn(locals, ViewContainerRef.$name))) return locals;

      const elementRef = new ElementRefImpl(nativeElement as HTMLElement);
      return { ...locals, [ViewContainerRef.$name]: new ViewContainerRefImpl(elementRef, $injector) };
    },
  });
}
decorateControllerViewContainerRef.$inject = ["$delegate", "$injector"];
