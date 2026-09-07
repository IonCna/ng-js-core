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
