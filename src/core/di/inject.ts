import type { InjectFlags } from "@/core/di/inject-flags.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";
import { currentInjectionResolver } from "@/core/di/injection-context.ts";
import { currentInjector } from "@/core/di/injector.ts";

export type InjectOptions = InjectFlags;

/** Resuelve un token desde el contexto activo o desde el injector global de la aplicación. */
export function inject<T>(token: ProviderToken<T> | string, options?: InjectOptions): T {
  const resolver = currentInjectionResolver();
  if (resolver) return resolver.get(token, options) as T;

  const injector = currentInjector();
  if (!injector) {
    throw new Error("inject(): no existe un contexto de inyección activo. Ejecuta el código dentro de una aplicación compilada.");
  }

  return injector.get(token);
}

/** Decorador declarativo para fijar explícitamente el token de un parámetro. */
export function Inject(token: ProviderToken<unknown> | string): ParameterDecorator {
  void token;
  return () => undefined;
}
