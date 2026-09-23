import type { InjectFlags } from "@/core/di/inject-flags.ts";
import { currentInjectionResolver } from "@/core/di/injection-context.ts";
import { InjectorImpl } from "@/core/di/injector.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

/** Opciones de `inject()` — misma forma que `InjectOptions` de `@angular/core`. */
export type InjectOptions = InjectFlags;

export function inject<T>(token: ProviderToken<T>): T;
export function inject<T = unknown>(token: string): T;
export function inject<T>(token: ProviderToken<T>, options: InjectOptions & { optional: true }): T | null;
export function inject<T = unknown>(token: string, options: InjectOptions & { optional: true }): T | null;
export function inject<T>(token: ProviderToken<T>, options: InjectOptions): T;
export function inject<T = unknown>(token: string, options: InjectOptions): T;
export function inject(token: ProviderToken<unknown> | string, options: InjectOptions = {}) {
  // Dentro de la construcción de un controller: resolver del contexto (locals de
  // ese elemento + inyector jerárquico + app), respetando `self`/`skipSelf`/
  // `host`/`optional`. Fuera: el `Injector` global (plano — solo `optional` aplica).
  const resolver = currentInjectionResolver();
  if (resolver) return resolver.get(token as never, options);
  return flatInject(token, options);
}

/**
 * El camino "plano" de `inject()` (`Injector` global de la app — sin nodo
 * jerárquico, solo `optional` aplica) SIN mirar `currentInjectionResolver()`.
 * Para código que necesita esa garantía siempre, no solo cuando el llamador
 * resulta no estar anidado dentro de una construcción jerárquica en este
 * instante — como `Service()`, cuyas deps de constructor deben resolver igual
 * sin importar si el singleton lazy se construye por primera vez porque lo
 * pidió una llamada de nivel app o porque lo disparó el `inject()` de un
 * componente en medio de su propia construcción (`currentInjectionResolver()`
 * quedaría con el resolver de ESE componente, ajeno al `@Service`).
 */
export function flatInject(token: ProviderToken<unknown> | string, options: InjectOptions = {}) {
  const injector = InjectorImpl.current;
  if (!injector) {
    throw new Error("inject() se llamó antes de que la app bootstrapee (todavía no hay Injector)");
  }

  if (!options.optional) return injector.get(token as never);
  try {
    return injector.get(token as never, null as never);
  } catch {
    return null;
  }
}
