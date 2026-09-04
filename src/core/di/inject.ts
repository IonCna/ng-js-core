import { InjectorImpl } from "@/core/di/injector.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

export function inject<T>(token: ProviderToken<T>, notFoundValue?: T): T;
export function inject<T = unknown>(token: string, notFoundValue?: T): T;
export function inject(token: ProviderToken<unknown> | string, notFoundValue?: unknown) {
  const injector = InjectorImpl.current;

  if (!injector) {
    throw new Error("inject() se llamó antes de que la app bootstrapee (todavía no hay Injector)");
  }

  return injector.get(token as never, notFoundValue as never);
}
