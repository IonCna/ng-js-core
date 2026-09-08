import { resolveForwardRef } from "@/core/di/forward-ref.ts";

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

/**
 * Desenvuelve los `forwardRef(() => X)` de un `@ContentChild`/`@ViewChild`
 * (locator y `read`). Se llama al CONSTRUIR la query — una vez por instancia —
 * momento en el que la clase referida por el `forwardRef` ya existe, aunque al
 * decorar la propiedad no lo hiciera (referencia circular entre archivos: el
 * `@ContentChildren(Foo)` de un archivo A corre mientras `Foo` — definido en B,
 * que a su vez importa A — todavía es `undefined`). Ver `forward-ref.ts`.
 */
export function resolveQueryLocator<T>(locator: QueryToken<T>): QueryToken<T> {
  return resolveForwardRef(locator);
}

export function resolveQueryOptions<T>(options: QueryOptions<T> | undefined): QueryOptions<T> | undefined {
  if (!options || options.read === undefined) return options;
  return { ...options, read: resolveForwardRef(options.read) as QueryToken<T> };
}
