import type angular from "angular";
import type { InjectFlags } from "@/core/di/inject-flags.ts";
import { type InjectionResolver, runInInjectionContext } from "@/core/di/injection-context.ts";
import { ReflectInjection } from "@/core/di/reflect.ts";
import { getFromAppInjector, hasInAppInjector } from "@/core/di/root-singleton-registry.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

const NODE_DATA_KEY = "$ngjsInjector";

interface ElementNodeLike {
  get(name: string, flags?: InjectFlags): unknown;
}
interface JqLite {
  inheritedData(name: string): unknown;
  controller?(name: string): unknown;
}

/**
 * Fallback estilo `require` de AngularJS: una directiva/componente publicada como
 * controller en ESTE elemento o un ancestro. Cubre `inject(TemplateRef)` desde
 * una directiva sobre `<ng-template>`, `inject(NgbNav)` desde una directiva
 * anidada, etc. — cómo Angular resuelve inyectar una directiva del host o de un
 * ancestro. Solo cuando no hay flags posicionales (`self`/`skipSelf`/`host`):
 * `jqLite.controller()` no los distingue.
 */
function fromElementController($element: JqLite | undefined, name: string, flags: InjectFlags): unknown {
  if (!$element?.controller || flags.self || flags.skipSelf || flags.host) return undefined;
  return $element.controller(name) ?? undefined;
}

/**
 * Activa un `InjectionResolver` mientras se construye cada controller, para que
 * `inject()` en un *field initializer* (`private cfg = inject(FooConfig)`) ande
 * como en Angular: resuelve contra los `locals` de ESE elemento (`ElementRef`,
 * `$attr:*`, lo que pusieron los otros bridges) → su inyector jerárquico
 * (`@Component({ providers })`) → el `$injector` de la app.
 *
 * **Se registra PRIMERO** (bridge más interno): así su `aroundInit` envuelve la
 * construcción real y los `locals` que ve ya tienen las claves de los demás bridges.
 */
export function decorateControllerInjectionContext(
  $delegate: angular.IControllerService,
  $injector: angular.auto.IInjectorService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    aroundInit: (construct, locals) => {
      const $element = locals?.$element as JqLite | undefined;
      const node = $element?.inheritedData?.(NODE_DATA_KEY) as ElementNodeLike | undefined;

      const resolver: InjectionResolver = {
        get(token, options: InjectFlags = {}) {
          // Un token que no se puede nombrar (p.ej. una clase `@Component` sin
          // provider) con `{ optional: true }` → `null`, como en Angular.
          let name: string;
          try {
            name = ReflectInjection.translate(token as never);
          } catch (error) {
            if (options.optional) return null;
            throw error;
          }

          // `skipSelf` salta los locals de ESTE elemento (`ElementRef`, `$attr:*`, …).
          if (!options.skipSelf && locals && Object.hasOwn(locals, name)) return locals[name];

          // El nodo jerárquico ya honra `self`/`skipSelf`/`host`/`optional` y cae al `$injector`.
          if (node) {
            try {
              return node.get(name, options);
            } catch (error) {
              const fromDom = fromElementController($element as JqLite | undefined, name, options);
              if (fromDom !== undefined) return fromDom;
              if (options.optional) return null;
              throw error;
            }
          }

          const fromDom = fromElementController($element as JqLite | undefined, name, options);
          if (fromDom !== undefined) return fromDom;

          // Sin nodo jerárquico: `self` = solo este elemento (ya miramos locals).
          if (options.self) {
            if (options.optional) return null;
            throw new Error(`inject(): no se resolvió "${name}" con { self: true }`);
          }
          if (options.optional && !hasInAppInjector($injector, name)) return null;
          return getFromAppInjector($injector, name);
        },
      };

      return runInInjectionContext(resolver, construct);
    },
  });
}
decorateControllerInjectionContext.$inject = ["$delegate", "$injector"];
