export { forwardRef, isForwardRef, resolveForwardRef } from "@/core/di/forward-ref.ts";
export type { InjectOptions } from "@/core/di/inject.ts";
export { Inject, inject } from "@/core/di/inject.ts";
export type { InjectFlags } from "@/core/di/inject-flags.ts";
export { Host, Optional, Self, SkipSelf } from "@/core/di/inject-flags.ts";
export type { InjectableOptions } from "@/core/di/injectable.ts";
export { Injectable } from "@/core/di/injectable.ts";
export type { InjectionResolver } from "@/core/di/injection-context.ts";
export { currentInjectionResolver, runInInjectionContext } from "@/core/di/injection-context.ts";
export type { InjectionTokenOptions } from "@/core/di/injection-token.ts";
export { InjectionToken } from "@/core/di/injection-token.ts";
export {
  currentInjector,
  Injector,
  InjectorImpl,
  injectionTokenName,
  unwrapAngularInjector,
} from "@/core/di/injector.ts";
export type {
  ClassProvider,
  ClassSansProvider,
  ConstructorProvider,
  ConstructorSansProvider,
  ExistingProvider,
  ExistingSansProvider,
  FactoryProvider,
  FactorySansProvider,
  Provider,
  TypeProvider,
  ValueProvider,
  ValueSansProvider,
} from "@/core/di/provider.ts";
export type { AbstractType, ProviderToken, Type } from "@/core/di/provider-token.ts";
