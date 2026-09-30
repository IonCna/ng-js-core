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

/** Lo que da `new ViewChild(...)` (y compañía) en `queries: { ... }` del decorador, como el `Query` de Angular. */
export interface Query {
  readonly selector: QueryToken<unknown>;
  readonly first: boolean;
  readonly isViewQuery: boolean;
  readonly descendants: boolean;
  readonly read?: QueryToken<unknown>;
  readonly static?: boolean;
}

/** Como en Angular: decorador de propiedad (`@ViewChild(X)`) y también `new ViewChild(X)` para `queries`. */
export interface QueryDecorator {
  (locator: QueryToken<unknown>, options?: QueryOptions): PropertyDecorator;
  new (locator: QueryToken<unknown>, options?: QueryOptions): Query;
}

/** Declarativo: `ng-js-compiler` lee el uso (decorador o `queries`) y emite la definición de la query. */
export function makeQueryDecorator(first: boolean, isViewQuery: boolean, descendants: boolean): QueryDecorator {
  return function (this: unknown, locator: QueryToken<unknown>, options?: QueryOptions) {
    if (!new.target) return () => undefined;
    return { descendants, ...options, selector: locator, first, isViewQuery };
  } as unknown as QueryDecorator;
}
