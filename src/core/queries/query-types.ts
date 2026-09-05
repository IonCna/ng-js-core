/**
 * Token de query — NO es `ProviderToken` de DI (`core/di/provider-token.ts`):
 * acá no hace falta `$name` (nunca se traduce a `$inject`/`$injector.get`,
 * la resolución es por candidatos publicados por los hijos, no por el
 * `$injector`). Cualquier clase sirve con solo tener `.prototype`; un string
 * es un locator de `ng-ref="nombre"` (ver `ng-ref-bridge.ts`).
 */
export type QueryToken<T> = string | { readonly prototype: T };

export interface QueryOptions<T = unknown> {
  readonly read?: QueryToken<T>;
  readonly static?: boolean;
  readonly descendants?: boolean;
}
