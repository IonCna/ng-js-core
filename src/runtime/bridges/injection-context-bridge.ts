import type angular from "angular";
import { type InjectionResolver, runInInjectionContext } from "@/core/di/injection-context.ts";
import { ReflectInjection } from "@/core/di/reflect.ts";
import { decorateControllerWith } from "@/runtime/bridges/shared.ts";

const NODE_DATA_KEY = "$ngjsInjector";

interface ElementNodeLike {
  get(name: string, flags?: Record<string, unknown>): unknown;
  has?(name: string): boolean;
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
        get(token, notFoundValue) {
          const name = ReflectInjection.translate(token as never);

          if (locals && Object.hasOwn(locals, name)) return locals[name];

          if (node) {
            try {
              const fromNode = node.get(name);
              if (fromNode !== undefined) return fromNode;
            } catch {
              /* el nodo no lo tiene / no lo puede armar — seguir al app injector */
            }
          }

          if (notFoundValue !== undefined && !$injector.has(name)) return notFoundValue;
          return $injector.get(name);
        },
      };

      return runInInjectionContext(resolver, construct);
    },
  });
}
decorateControllerInjectionContext.$inject = ["$delegate", "$injector"];
