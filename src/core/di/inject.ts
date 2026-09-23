import type { InjectFlags } from "@/core/di/inject-flags.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

export type InjectOptions = InjectFlags;

/** Decorador declarativo para fijar explícitamente el token de un parámetro. */
export function Inject(token: ProviderToken<unknown> | string): ParameterDecorator {
  void token;
  return () => undefined;
}
