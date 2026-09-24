import type { InjectFlags } from "@/core/di/inject-flags.ts";
import { currentInjectionResolver } from "@/core/di/injection-context.ts";
import { currentInjector } from "@/core/di/injector.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

export type InjectOptions = InjectFlags;

/**
 * `inject()` durante la construcción de una clase compilada no llega acá: `ng-js-compiler` la reemplaza en build
 * por el valor ya resuelto. Esta es la de runtime — un `inject()` dentro de una función que corre después (un
 * callback, un método): resuelve contra el contexto activo o, si no hay, contra el injector de la app arrancada.
 */
export function inject<T>(token: ProviderToken<T> | string, options?: InjectOptions): T {
  const resolver = currentInjectionResolver();
  if (resolver) return resolver.get(token, options) as T;

  const injector = currentInjector();
  if (!injector) {
    if (options?.optional) return null as T;
    throw new Error(
      "inject(): no existe un contexto de inyección activo. Ejecuta el código dentro de una aplicación compilada.",
    );
  }

  // Sin injector de elemento, `self`/`host` no tienen dónde buscar: solo el de la app (como `ɵresolve`).
  return options?.optional ? (injector.get(token, null) as T) : injector.get(token);
}

/** Decorador declarativo para fijar explícitamente el token de un parámetro. */
export function Inject(token: ProviderToken<unknown> | string): ParameterDecorator {
  void token;
  return () => undefined;
}
