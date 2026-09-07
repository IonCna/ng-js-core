import type angular from "angular";
import type { InjectFlags } from "@/core/di/inject-flags.ts";
import { type InjectionResolver, runInInjectionContext } from "@/core/di/injection-context.ts";
import { ReflectInjection } from "@/core/di/reflect.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

const NODE_DATA_KEY = "$ngjsInjector";

interface ElementNodeLike {
  get(name: string, flags?: InjectFlags): unknown;
}
interface JqLite {
  inheritedData(name: string): unknown;
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
              if (options.optional) return null;
              throw error;
            }
          }

          // Sin nodo jerárquico: `self` = solo este elemento (ya miramos locals).
          if (options.self) {
            if (options.optional) return null;
            throw new Error(`inject(): no se resolvió "${name}" con { self: true }`);
          }
          if (options.optional && !$injector.has(name)) return null;
          return $injector.get(name);
        },
      };

      return runInInjectionContext(resolver, construct);
    },
  });
}
decorateControllerInjectionContext.$inject = ["$delegate", "$injector"];
