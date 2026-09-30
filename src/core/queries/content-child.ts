import { makeQueryDecorator, type QueryDecorator } from "@/core/queries/query-types.ts";

/** Decorador declarativo (o `new ContentChild(...)` en `queries`); `ng-js-compiler` emite la definición de la query. */
export const ContentChild: QueryDecorator = makeQueryDecorator(true, false, true);
