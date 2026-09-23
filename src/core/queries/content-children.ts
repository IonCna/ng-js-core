import type { QueryOptions, QueryToken } from "@/core/queries/query-types.ts";

/** Decorador declarativo; `ng-js-compiler` emite la definición de la query. */
export function ContentChildren(_locator: QueryToken<unknown>, _options?: QueryOptions): PropertyDecorator {
  return () => undefined;
}
