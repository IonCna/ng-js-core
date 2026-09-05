/**
 * Token de query — NO es `ProviderToken` de DI (`core/di/provider-token.ts`):
 * acá no hace falta `$name` (nunca se traduce a `$inject`/`$injector.get`,
 * la resolución es por candidatos publicados por los hijos, no por el
 * `$injector`). Cualquier clase sirve con solo tener `.prototype`.
 */
export type QueryToken<T> = { readonly prototype: T };
