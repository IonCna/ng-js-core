import type { ProviderToken } from "@/core/di/provider-token.ts";

/**
 * Resolutor activo mientras se construye un controller — así `inject()` en un
 * *field initializer* (`private cfg = inject(FooConfig)`, estilo Angular /
 * ng-bootstrap) resuelve contra los `locals` de ESE elemento (`ElementRef`,
 * `$attr:*`, …) + su inyector jerárquico + el `$injector` de la app, en vez de
 * caer directo al global. Fuera de una construcción, `inject()` usa el global.
 */
export interface InjectionResolver {
  get(token: ProviderToken<unknown> | string, notFoundValue?: unknown): unknown;
}

const stack: InjectionResolver[] = [];

export function runInInjectionContext<T>(resolver: InjectionResolver, fn: () => T): T {
  stack.push(resolver);
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

export function currentInjectionResolver(): InjectionResolver | undefined {
  return stack.at(-1);
}
