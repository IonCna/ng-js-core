import type angular from "angular";
import type { ProviderToken } from "@/core/di/provider-token.ts";

const INJECTOR_GLOBAL = "ɵngjsInjector";

/** Fachada pública del injector de AngularJS. */
export abstract class Injector {
  abstract get<T>(token: ProviderToken<T> | string, notFoundValue?: T): T;
}

/** Obtiene el nombre que el compiler estampó para un token. */
export function injectionTokenName(token: ProviderToken<unknown> | string): string {
  if (typeof token === "string") return token;

  const definition = (token as { ɵprov?: { token?: unknown } }).ɵprov;
  if (typeof definition?.token === "string") return definition.token;

  throw new Error("El token no tiene metadata compilada (ɵprov). Compila la aplicación con ng-js-cli.");
}

export class InjectorImpl extends Injector {
  private static _current?: InjectorImpl;

  static get current(): InjectorImpl | undefined {
    return InjectorImpl._current;
  }

  constructor(private readonly $injector: angular.auto.IInjectorService) {
    super();
    InjectorImpl._current = this;
  }

  get nativeInjector(): angular.auto.IInjectorService {
    return this.$injector;
  }

  get<T>(token: ProviderToken<T> | string, notFoundValue?: T): T {
    const name = injectionTokenName(token);
    if (notFoundValue !== undefined && !this.$injector.has(name)) return notFoundValue;
    return this.$injector.get(name) as T;
  }
}

export function currentInjector(): InjectorImpl | undefined {
  const native = (globalThis as Record<string, unknown>)[INJECTOR_GLOBAL];
  if (native) return new InjectorImpl(native as angular.auto.IInjectorService);

  return InjectorImpl.current;
}

export function unwrapAngularInjector(injector: Injector): angular.auto.IInjectorService {
  if (injector instanceof InjectorImpl) return injector.nativeInjector;

  const native = (injector as { nativeInjector?: angular.auto.IInjectorService }).nativeInjector;
  if (native) return native;

  throw new Error("unwrapAngularInjector: el Injector no envuelve un $injector de AngularJS");
}
