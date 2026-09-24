import type angular from "angular";
import type { InjectFlags } from "@/core/di/inject-flags.ts";
import { type InjectionResolver, runInInjectionContext } from "@/core/di/injection-context.ts";
import { injectionTokenName } from "@/core/di/injector.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";
import { CompiledType } from "@/core/metadata/compiled-type.ts";
import { ElementTokens } from "@/native/bridges/element-tokens-bridge.ts";
import { decorateControllerWith } from "@/native/bridges/shared.ts";

/** jqLite `data()` del injector por elemento que emite `ng-js-compiler` (`ScopedInjectorRuntime`). */
const SCOPED_INJECTOR_DATA_KEY = "$ngjsScopedInjector";

/** Lo que usa este bridge del nodo que emite el compilador (`ɵElementInjectorNode`). */
interface ScopedInjectorNode {
  provides(name: string): boolean;
  resolveWith(name: string, flags: InjectFlags): unknown;
}

type Locals = Record<string, unknown>;

/**
 * El `inject()` de una construcción: resuelve como resolvería el `ɵfac` de esa clase — `locals` del elemento, los
 * tokens de elemento (`ElementRef`, `DestroyRef`, …), el injector por elemento (`providers` de componentes), una
 * directiva/componente del elemento o sus ancestros (por clase), y por último el `$injector` de la app.
 */
class ConstructionResolver implements InjectionResolver {
  constructor(
    private readonly locals: Locals | undefined,
    private readonly $injector: angular.auto.IInjectorService,
  ) {}

  get(token: ProviderToken<unknown> | string, options: InjectFlags = {}): unknown {
    const $element = this.locals?.$element as angular.IAugmentedJQuery | undefined;

    // Una clase `@Component`/`@Directive` como token: su instancia en el elemento (lo que hace `require`).
    if (typeof token === "function" && CompiledType.def(token)) {
      const found = options.skipSelf
        ? CompiledType.instanceOn($element?.parent(), token)
        : CompiledType.instanceOn($element, token);
      if (found !== undefined) return found;
      if (options.optional) return null;
      throw new Error(`inject(): no hay una instancia de "${token.name}" en este elemento ni en sus ancestros.`);
    }

    let name: string;
    try {
      name = injectionTokenName(token);
    } catch (error) {
      if (options.optional) return null;
      throw error;
    }

    if (!options.skipSelf && this.locals && Object.hasOwn(this.locals, name)) return this.locals[name];
    if (!options.skipSelf && ElementTokens.has(name)) return ElementTokens.resolve(name, this.locals, this.$injector);

    const node = $element?.inheritedData(SCOPED_INJECTOR_DATA_KEY) as ScopedInjectorNode | undefined;
    if (node && (node.provides(name) || options.self || options.host)) return node.resolveWith(name, options);

    // Sin injector de elemento: `self`/`host` no tienen dónde buscar más que lo propio (ya mirado).
    if (options.self || options.host) {
      if (options.optional) return null;
      throw new Error(`inject(): no se resolvió "${name}" con { ${options.self ? "self" : "host"}: true }.`);
    }
    if (options.optional && !this.$injector.has(name)) return null;
    return this.$injector.get(name);
  }
}

/**
 * `inject()` en código de runtime que corre DURANTE la construcción de un controller (el compilador ya reemplazó
 * los `inject()` del propio archivo; esto cubre los de funciones de librería, como `takeUntilDestroyed()` en un
 * inicializador de campo). Se registra primero (el decorador más interno): envuelve la construcción real y sus
 * `locals` ya traen lo que agregaron los demás bridges.
 */
export function decorateControllerInjectionContext(
  $delegate: angular.IControllerService,
  $injector: angular.auto.IInjectorService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    aroundInit: (construct, locals) => runInInjectionContext(new ConstructionResolver(locals, $injector), construct),
  });
}
decorateControllerInjectionContext.$inject = ["$delegate", "$injector"];
