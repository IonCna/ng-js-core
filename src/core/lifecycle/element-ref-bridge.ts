import type angular from "angular";
import { decorateControllerWith } from "@/core/lifecycle/shared.ts";
import { ElementRef, ElementRefImpl } from "@/core/refs/element-ref.ts";

/**
 * Agrega `ElementRef` a `locals` antes de instanciar, para que un ctor que
 * lo pida (`constructor(el: ElementRef)`, resuelve por `ElementRef.$name`,
 * como cualquier otra clase-token) lo reciba sin tener que pedirle nada al
 * `$injector` — no es un servicio de AngularJS, es por-instancia (depende de
 * qué `$element` es cada una).
 *
 * Primer uso de `augmentLocals` en `shared.ts` — valida el mecanismo de
 * "agregar locals antes de construir" que el inyector jerárquico (etapa 5)
 * también va a necesitar, con un caso más simple (un solo valor fijo, no un
 * set dinámico de providers).
 */
export function decorateControllerElementRef($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $element = locals?.$element as { [i: number]: Element } | undefined;
      const nativeElement = $element?.[0];
      if (!nativeElement || (locals && Object.hasOwn(locals, ElementRef.$name))) return locals;

      return { ...locals, [ElementRef.$name]: new ElementRefImpl(nativeElement) };
    },
  });
}
decorateControllerElementRef.$inject = ["$delegate"];
