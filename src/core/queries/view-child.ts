import { makeQueryDecorator, type QueryDecorator } from "@/core/queries/query-types.ts";

/** Decorador declarativo (o `new ViewChild(...)` en `queries`); `ng-js-compiler` emite la definición de la query. */
export const ViewChild: QueryDecorator = makeQueryDecorator(true, true, true);
