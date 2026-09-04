import type { ProviderToken, Type } from "@/core/di/provider-token.ts";

type Token<T> = ProviderToken<T> | string;

export interface ValueSansProvider<T = unknown> {
  useValue: T;
}

export interface ValueProvider<T = unknown> extends ValueSansProvider<T> {
  provide: Token<T>;
  multi?: boolean;
}

export interface ClassSansProvider<T = unknown> {
  useClass: Type<T>;
}

export interface ClassProvider<T = unknown> extends ClassSansProvider<T> {
  provide: Token<T>;
  multi?: boolean;
}

export interface ExistingSansProvider<T = unknown> {
  useExisting: Token<T>;
}

export interface ExistingProvider<T = unknown> extends ExistingSansProvider<T> {
  provide: Token<T>;
  multi?: boolean;
}

export interface FactorySansProvider<T = unknown> {
  useFactory: (...args: never[]) => T;
  deps?: readonly Token<unknown>[];
}

export interface FactoryProvider<T = unknown> extends FactorySansProvider<T> {
  provide: Token<T>;
  multi?: boolean;
}

export interface ConstructorSansProvider {
  deps?: readonly Token<unknown>[];
}

export interface ConstructorProvider extends ConstructorSansProvider {
  provide: Type<unknown>;
  multi?: boolean;
}

export type TypeProvider = Type<unknown>;

export type Provider =
  | TypeProvider
  | ValueProvider
  | ClassProvider
  | ConstructorProvider
  | ExistingProvider
  | FactoryProvider
  | Provider[];
