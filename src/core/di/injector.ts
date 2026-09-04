import type angular from "angular";
import { ReflectInjection } from "@/core/di/reflect.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

export abstract class Injector {
  static readonly $name = "Injector";

  abstract get<T>(token: ProviderToken<T>, notFoundValue?: T): T;
  abstract get<T = unknown>(token: string, notFoundValue?: T): T;
}

/**
 * Envuelve el `$injector` real de AngularJS. Se auto-captura al construirse
 * (AngularJS la instancia una sola vez, como cualquier `.service()`) para que
 * `inject()` — que corre fuera de cualquier construcción manejada por
 * AngularJS — tenga de dónde agarrar una instancia viva.
 */
export class InjectorImpl extends Injector {
  static readonly $inject = ["$injector"];

  private static _current?: InjectorImpl;

  static get current(): InjectorImpl | undefined {
    return InjectorImpl._current;
  }

  constructor(private readonly $injector: angular.auto.IInjectorService) {
    super();
    InjectorImpl._current = this;
  }

  get<T>(token: ProviderToken<T> | string, notFoundValue?: T): T {
    const name = ReflectInjection.translate(token);

    if (notFoundValue !== undefined && !this.$injector.has(name)) {
      return notFoundValue;
    }

    return this.$injector.get<T>(name);
  }
}
