import type { InjectionToken } from "@/core/di/injection-token.ts";

/** Clase concreta que puede usarse como token de provider. */
export type Type<T> = new (...args: never[]) => T;

/** Clase abstracta que puede usarse como token sin ser construida directamente. */
export type AbstractType<T> = { readonly prototype: T };

/** Token aceptado por DI: clase, clase abstracta o `InjectionToken`. */
export type ProviderToken<T> = Type<T> | AbstractType<T> | InjectionToken<T>;
