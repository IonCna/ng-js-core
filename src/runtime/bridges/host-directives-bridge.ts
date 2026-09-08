import type angular from "angular";
import { resolveForwardRef } from "@/core/di/forward-ref.ts";
import { getInjectableId } from "@/core/di/injectable-registry.ts";
import type { HostDirectiveDef } from "@/core/metadata/def.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";

type ControllerInvoke = (
  expression: unknown,
  locals?: Record<string, unknown>,
  later?: boolean,
  identifier?: string,
) => unknown;

interface LifecycleController {
  $onInit?: () => void;
  $postLink?: () => void;
  $onDestroy?: () => void;
}

interface JqLiteData {
  data(key: string): unknown;
  data(key: string, value: unknown): void;
}

/** Las clases de `hostDirectives` de `clase`, con los `forwardRef` ya desenvueltos. */
function hostDirectiveClasses(clase: Function): Function[] {
  const def = getComponentDef(clase) ?? getDirectiveDef(clase);
  const entries = (def?.hostDirectives ?? []) as HostDirectiveDef[];
  return entries.map((entry) => resolveForwardRef(typeof entry === "function" ? entry : entry.directive) as Function);
}

/** `$<sel>Controller` — la misma clave con que AngularJS publica el controller de una directiva y que lee `jqLite.controller(sel)`. */
function controllerDataKey(clase: Function): string | undefined {
  const id = getInjectableId(clase);
  return id ? `$${id}Controller` : undefined;
}

/**
 * `hostDirectives` de Angular 15+: compone otras directivas sobre el MISMO
 * `$element` que la directiva host. Este bridge las instancia **antes** de
 * construir el host, sobre su mismo elemento, así:
 *
 * - sus `@HostBinding` / `@HostListener` corren contra ese elemento (los bridges
 *   respectivos ya lo hacen en `onInstance`);
 * - su `inject()` resuelve como el de cualquier directiva del elemento;
 * - quedan `inject()`-ables desde el host (`$element.data("$<sel>Controller")`,
 *   que es lo que lee `jqLite.controller()` → el fallback estilo `require` de
 *   `injection-context-bridge`).
 *
 * Se registra como el decorador de `$controller` **más externo**: así el
 * `$delegate` de acá (`invoke`) es toda la cadena de bridges internos
 * (`lifecycle`, `hostBindings`, `hostListeners`, `injectionContext`, …) y la
 * directiva compuesta pasa por todos ellos.
 *
 * Limitaciones (por ahora): no reenvía `inputs`/`outputs` de la forma larga
 * `{ directive, inputs, outputs }` (AngularJS no corre `initializeDirectiveBindings`
 * sobre una instancia que no creó), y no soporta `hostDirectives` en un
 * `@Component` de elemento (el `expression` que llega a `$controller` no es la
 * clase); sí funciona en `@Component` de atributo y en `@Directive`.
 */
export function decorateControllerHostDirectives($delegate: angular.IControllerService): angular.IControllerService {
  const invoke = $delegate as unknown as ControllerInvoke;

  const wrapped: ControllerInvoke = (expression, locals, later, identifier) => {
    if (typeof expression === "function") {
      applyHostDirectives(expression as Function, locals);
    }
    return invoke(expression, locals, later, identifier);
  };

  function applyHostDirectives(hostClass: Function, locals: Record<string, unknown> | undefined): void {
    const classes = hostDirectiveClasses(hostClass);
    if (classes.length === 0) return;

    const $element = locals?.$element as (angular.IAugmentedJQuery & JqLiteData) | undefined;
    if (!$element) return;
    const $scope = locals?.$scope as angular.IScope | undefined;

    for (const Clase of classes) {
      const key = controllerDataKey(Clase);
      if (!key) continue;
      // ya está en el elemento: selector explícito en el markup, u otro `hostDirectives`.
      if ($element.data(key) !== undefined) continue;

      // `wrapped` (no `invoke`): así una directiva compuesta con SUS PROPIOS
      // `hostDirectives` también se resuelve. `later` sin setear → instancia ya.
      const instance = wrapped(Clase, locals) as LifecycleController;
      $element.data(key, instance);

      // AngularJS no conoce esta instancia — su ciclo de vida lo corremos a mano.
      instance.$onInit?.();
      if (instance.$postLink) {
        const runPostLink = instance.$postLink.bind(instance);
        Promise.resolve().then(runPostLink);
      }
      if (instance.$onDestroy && $scope) {
        $scope.$on("$destroy", () => instance.$onDestroy?.());
      }
    }
  }

  return wrapped as unknown as angular.IControllerService;
}
decorateControllerHostDirectives.$inject = ["$delegate"];
