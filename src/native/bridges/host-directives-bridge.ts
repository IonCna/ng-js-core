import type angular from "angular";
import { type CompiledHostDirectiveDef, CompiledType } from "@/core/metadata/compiled-type.ts";

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
 * `inputs`/`outputs` de la forma larga (`{ directive, inputs: ["text: tooltipText"], outputs: ["shown"] }`) se reenvían
 * como en Angular: el host los expone con su alias como atributos de su elemento, y solo esos (AngularJS no bindea una
 * instancia que no creó, así que se bindean acá, contra el scope donde está el elemento del host). Los valores
 * iniciales y el primer `ngOnChanges` llegan antes de `ngOnInit`.
 *
 * Limitación: una directiva compuesta necesita selector (su nombre de registro es la clave de `data()`).
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

      // El scope donde se evalúan los atributos del elemento: el de afuera (un componente tiene scope aislado).
      const outer = $scope && CompiledType.isComponent(hostType) ? $scope.$parent : $scope;
      const $attrs = locals?.$attrs as angular.IAttributes | undefined;
      if (outer && $attrs)
        HostDirectiveBindings.forward(entry, type, instance as Record<string, unknown>, outer, $attrs, $element);

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

interface EmitterLike {
  subscribe(next: (value: unknown) => void): { unsubscribe(): void };
}

/** El reenvío de `inputs`/`outputs` de una entrada de `hostDirectives` (ver `decorateControllerHostDirectives`). */
class HostDirectiveBindings {
  static forward(
    entry: CompiledHostDirectiveDef,
    type: Function,
    instance: Record<string, unknown>,
    outer: angular.IScope,
    $attrs: angular.IAttributes,
    $element: angular.IAugmentedJQuery,
  ): void {
    const def = CompiledType.def(type);
    if (!def) return;
    const bindings = (def.definition?.bindings ?? def.definition?.bindToController ?? {}) as Record<string, string>;
    const unsubscribers: (() => void)[] = [];

    const changes: Record<string, { currentValue: unknown; previousValue: unknown; isFirstChange(): boolean }> = {};
    for (const [publicName, alias] of HostDirectiveBindings.pairs(entry.inputs)) {
      const propName = def.inputs[publicName];
      if (propName === undefined) throw new Error(`hostDirectives: "${type.name}" no tiene un input "${publicName}".`);
      const attribute = CompiledType.camelCase(alias);
      const interpolated = (bindings[propName] ?? "").startsWith("@");
      let first = true;
      let previous: unknown;
      const assign = (value: unknown): void => {
        const isFirst = first;
        first = false;
        const change = { currentValue: value, previousValue: previous, isFirstChange: () => isFirst };
        previous = value;
        instance[propName] = value;
        if (isFirst) changes[propName] = change;
        else (instance as { $onChanges?(changes: object): void }).$onChanges?.({ [propName]: change });
      };

      const source = $attrs[attribute] as string | undefined;
      if (source === undefined) continue;
      if (interpolated) {
        const $interpolate = $element.injector().get("$interpolate");
        assign($interpolate(source)(outer));
        unsubscribers.push($attrs.$observe(attribute, (value) => value !== previous && assign(value)) as () => void);
      } else {
        assign(outer.$eval(source));
        unsubscribers.push(outer.$watch(source, (value, old) => value !== old && assign(value)));
      }
    }
    if (Object.keys(changes).length) (instance as { $onChanges?(changes: object): void }).$onChanges?.(changes);

    for (const [publicName, alias] of HostDirectiveBindings.pairs(entry.outputs)) {
      const propName = def.outputs[publicName];
      if (propName === undefined) throw new Error(`hostDirectives: "${type.name}" no tiene un output "${publicName}".`);
      const source = $attrs[CompiledType.camelCase(alias)] as string | undefined;
      const emitter = instance[propName] as EmitterLike | undefined;
      if (source === undefined || !emitter || typeof emitter.subscribe !== "function") continue;
      const subscription = emitter.subscribe((value) => outer.$eval(source, { $event: value }));
      unsubscribers.push(() => subscription.unsubscribe());
    }

    if (!unsubscribers.length) return;
    const release = (): void => {
      for (const off of unsubscribers.splice(0)) off();
    };
    // Lo que llegue primero: el scope de afuera, o el elemento (un `ng-if` lo saca sin destruir ese scope).
    outer.$on("$destroy", release);
    $element.on("$destroy", release);
  }

  /** `["text: tooltipText", "open"]` → `[["text", "tooltipText"], ["open", "open"]]` (nombre público → alias). */
  private static pairs(list: string[] | undefined): [string, string][] {
    return (list ?? []).map((item) => {
      const [name = "", alias] = item.split(":").map((part) => part.trim());
      return [name, alias || name];
    });
  }
}
