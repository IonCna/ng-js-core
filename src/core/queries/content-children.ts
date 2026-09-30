import { makeQueryDecorator, type QueryDecorator } from "@/core/queries/query-types.ts";

/** Decorador declarativo (o `new ContentChildren(...)` en `queries`); `ng-js-compiler` emite la definición de la query. */
export const ContentChildren: QueryDecorator = makeQueryDecorator(false, false, false);
