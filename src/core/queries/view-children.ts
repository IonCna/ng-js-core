import { makeQueryDecorator, type QueryDecorator } from "@/core/queries/query-types.ts";

/** Decorador declarativo (o `new ViewChildren(...)` en `queries`); `ng-js-compiler` emite la definición de la query. */
export const ViewChildren: QueryDecorator = makeQueryDecorator(false, true, true);
