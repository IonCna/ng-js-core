import type angular from "angular";
import { getInjectFlags } from "@/core/di/inject-flags.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import { SelectorRegistry } from "@/core/metadata/selector-registry.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";
import { ElementInjectorNode } from "@/runtime/element-injector-node.ts";

const NODE_DATA_KEY = "$ngjsInjector";

interface JqLiteData {
  data(name: string): unknown;
  data(name: string, value: unknown): void;
  inheritedData(name: string): unknown;
  parent(): JqLiteData;
}

/**
 * Encuentra/crea el `ElementInjectorNode` de este `$element` y resuelve contra
 * él cada entrada de `Clase.$inject` — en vez del array plano que resolvería
 * `$injector.instantiate` por su cuenta — metiendo el resultado en `locals`
 * (mismo mecanismo que `element-ref-bridge`/`attribute-bridge`: `locals`
 * gana sobre `$injector` en la resolución nativa de AngularJS).
 *
 * Se registra ANTES que `element-ref-bridge`/`attribute-bridge`/etc. (ver
 * `docs/CONCEPTOS.md` "Inyector jerárquico" y el orden de `.decorator()` en
 * el módulo que arma todos los bridges): como cada `.decorator()` envuelve al
 * anterior, el que se registra primero termina siendo el más interno y corre
 * su `augmentLocals` AL FINAL — así ve ya puestas las claves que agregaron
 * los demás (`ElementRef`, `$attr:*`) y las salta (`Object.hasOwn`), en vez de
 * intentar resolverlas él también como si fueran tokens de DI cualquiera.
 */
export function decorateControllerScopedInjector(
  $delegate: angular.IControllerService,
  $injector: angular.auto.IInjectorService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    augmentLocals: (locals) => {
      const $element = locals?.$element as JqLiteData | undefined;
      const nativeElement = ($element as unknown as { [i: number]: Element } | undefined)?.[0];
      const tagName = nativeElement?.tagName;
      if (!$element || !tagName) return locals;

      const Clase = SelectorRegistry.getClass(tagName);
      if (!Clase) return locals;

      const ownProviders = (getComponentDef(Clase) ?? getDirectiveDef(Clase))?.providers ?? [];

      // `$element` todavía no tiene data propia acá (recién estamos por ponerla si
      // corresponde), así que esto es lo mismo que preguntar por el nodo del padre.
      let node = $element.inheritedData(NODE_DATA_KEY) as ElementInjectorNode | undefined;
      if (ownProviders.length > 0) {
        node = new ElementInjectorNode(ownProviders, node, $injector);
        $element.data(NODE_DATA_KEY, node);

        const $scope = locals?.$scope as angular.IScope | undefined;
        $scope?.$on("$destroy", () => node?.destroy());
      }
      if (!node) return locals; // sin nodo en ningún nivel: nada que resolver distinto de lo nativo

      const $inject = (Clase as unknown as { $inject?: readonly string[] }).$inject ?? [];
      let extra: Record<string, unknown> | undefined;
      $inject.forEach((name, index) => {
        if (locals && Object.hasOwn(locals, name)) return; // otro bridge ya lo puso (ElementRef, $attr:*, ...)
        extra ??= {};
        extra[name] = node!.get(name, getInjectFlags(Clase, index));
      });

      return extra ? { ...locals, ...extra } : locals;
    },
  });
}
decorateControllerScopedInjector.$inject = ["$delegate", "$injector"];
