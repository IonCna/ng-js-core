import type angular from "angular";
import { CompiledType } from "@/core/metadata/compiled-type.ts";

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

/**
 * `hostDirectives` de Angular 15+ (`ɵcmp`/`ɵdir.hostDirectives`, que deja el compilador): compone otras directivas
 * sobre el MISMO `$element` que la directiva host. Se instancian **antes** de construir el host (`ɵfac.ɵtype` dice
 * qué clase se va a construir), sobre su mismo elemento, así:
 *
 * - su `@HostBinding`/`@HostListener` (que el compilador puso en su `ɵfac`) corre contra ese elemento;
 * - quedan en `$element.data("$<nombre>Controller")` — de ahí las lee el `ɵfac` del host cuando las inyecta (como
 *   hace con cualquier directiva del elemento) y `require`.
 *
 * Se registra como el decorador de `$controller` **más externo**: el `$delegate` de acá es toda la cadena de
 * bridges, así la directiva compuesta pasa por todos ellos.
 *
 * Limitaciones: no reenvía `inputs`/`outputs` de la forma larga (AngularJS no bindea una instancia que no creó), y
 * una directiva compuesta necesita selector (su nombre de registro es la clave de `data()`).
 */
export function decorateControllerHostDirectives($delegate: angular.IControllerService): angular.IControllerService {
  const invoke = $delegate as unknown as ControllerInvoke;

  const wrapped: ControllerInvoke = (expression, locals, later, identifier) => {
    const hostType = CompiledType.ofExpression(expression);
    if (hostType) HostDirectives.apply(hostType, locals, wrapped);
    return invoke(expression, locals, later, identifier);
  };

  return wrapped as unknown as angular.IControllerService;
}
decorateControllerHostDirectives.$inject = ["$delegate"];

class HostDirectives {
  static apply(hostType: Function, locals: Record<string, unknown> | undefined, construct: ControllerInvoke): void {
    const entries = CompiledType.def(hostType)?.hostDirectives ?? [];
    if (entries.length === 0) return;

    const $element = locals?.$element as angular.IAugmentedJQuery | undefined;
    if (!$element) return;
    const $scope = locals?.$scope as angular.IScope | undefined;

    for (const entry of entries) {
      const type = entry.directive;
      const [name] = CompiledType.registrationNames(type);
      if (!name) {
        throw new Error(`hostDirectives: "${type.name}" necesita selector — es la clave con que queda en el elemento.`);
      }
      const key = `$${name}Controller`;
      // Ya está en el elemento: selector explícito en el markup, u otro `hostDirectives`.
      if ($element.data(key) !== undefined) continue;

      // `construct` (no `$delegate`): una directiva compuesta con SUS PROPIOS `hostDirectives` también se resuelve.
      // Sin `later`: la instancia se crea ya.
      const factory = (type as { ɵfac?: unknown }).ɵfac;
      const instance = construct(factory, locals) as LifecycleController;
      $element.data(key, instance);

      // AngularJS no conoce esta instancia: su ciclo de vida corre a mano.
      instance.$onInit?.();
      if (instance.$postLink) {
        const runPostLink = instance.$postLink.bind(instance);
        ($scope as (angular.IScope & { $$postDigest(fn: () => void): void }) | undefined)?.$$postDigest(runPostLink);
      }
      if (instance.$onDestroy && $scope) {
        $scope.$on("$destroy", () => instance.$onDestroy?.());
      }
    }
  }
}
