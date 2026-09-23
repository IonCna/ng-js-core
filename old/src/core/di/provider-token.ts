import type { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * Una clase normal, instanciable con `new`, que además carga el nombre con el
 * que se registra en AngularJS (mismo patrón que `NgZone.$name` /
 * `ApplicationRef.$name`).
 */
export type Type<T> = { new (...args: never[]): T };

/**
 * Referencia a una clase `abstract` (no instanciable directamente, TS no deja
 * hacerle `new`). Sirve como token para cosas como `Injector`/`ApplicationRef`
 * /`ErrorHandler`/`NgZone`, que son abstractas con una `Impl` concreta detrás.
 */
export type AbstractType<T> = { readonly prototype: T; readonly $name?: string };

/** Igual a `ProviderToken<T>` de `@angular/core`. */
export type ProviderToken<T> = Type<T> | AbstractType<T> | InjectionToken<T>;
