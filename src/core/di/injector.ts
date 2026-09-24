import type angular from "angular";
import { Injectable } from "@/core/di/injectable.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

const INJECTOR_GLOBAL = "ɵngjsInjector";

/** Distingue "sin `notFoundValue`" de un `notFoundValue` que vale `undefined`. */
const NOT_PROVIDED = Symbol("ngjs.notProvided");

/** Obtiene el nombre de DI que el compilador estampó para un token (`ɵprov.token`); un string es el nombre tal cual. */
export function injectionTokenName(token: ProviderToken<unknown> | string): string {
  if (typeof token === "string") return token;

  const definition = (token as { ɵprov?: { token?: unknown } }).ɵprov;
  if (typeof definition?.token === "string") return definition.token;

  const name = (token as { name?: string }).name ?? String(token);
  throw new Error(
    `"${name}" no tiene nombre de DI en runtime (ɵprov): agregale @Injectable() si es una clase, o compilá con ng-js-cli.`,
  );
}

/**
 * Fachada pública del injector de AngularJS. Se provee sola en la raíz (`providedIn: "root"`): cualquier clase la
 * puede pedir en el constructor (`constructor(injector: Injector)`) o con `inject(Injector)`.
 */
@Injectable({
  providedIn: "root",
  useFactory: ($injector: angular.auto.IInjectorService) => new InjectorImpl($injector),
  deps: ["$injector"],
})
export abstract class Injector {
  /** Sin `notFoundValue` un token sin provider es error; con él, se devuelve ese valor (`null` para opcional). */
  abstract get<T>(token: ProviderToken<T> | string, notFoundValue?: T | null): T;
}

export class InjectorImpl extends Injector {
  constructor(private readonly $injector: angular.auto.IInjectorService) {
    super();
  }

  get nativeInjector(): angular.auto.IInjectorService {
    return this.$injector;
  }

  get<T>(token: ProviderToken<T> | string, notFoundValue: T | null | typeof NOT_PROVIDED = NOT_PROVIDED): T {
    const name = injectionTokenName(token);
    if (notFoundValue !== NOT_PROVIDED && !this.$injector.has(name)) return notFoundValue as T;
    return this.$injector.get(name) as T;
  }
}

/** El injector de la app arrancada (lo deja la plataforma en `globalThis.ɵngjsInjector`), si hay una. */
export function currentInjector(): InjectorImpl | undefined {
  const native = (globalThis as Record<string, unknown>)[INJECTOR_GLOBAL] as angular.auto.IInjectorService | undefined;
  return native ? new InjectorImpl(native) : undefined;
}

export function unwrapAngularInjector(injector: Injector): angular.auto.IInjectorService {
  if (injector instanceof InjectorImpl) return injector.nativeInjector;

  const native = (injector as { nativeInjector?: angular.auto.IInjectorService }).nativeInjector;
  if (native) return native;

  throw new Error("unwrapAngularInjector: el Injector no envuelve un $injector de AngularJS");
}
