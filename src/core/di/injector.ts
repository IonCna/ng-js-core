import type angular from "angular";
import { ReflectInjection } from "@/core/di/reflect.ts";
import { getFromAppInjector, hasInAppInjector } from "@/core/di/root-singleton-registry.ts";
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

  /** El `$injector` real que envuelve — para código interno del runtime que necesita la API nativa completa (`.has`, servicios por nombre como `"$q"`/`"$compile"`), no solo `.get(token)`. Ver `unwrapAngularInjector`. */
  get nativeInjector(): angular.auto.IInjectorService {
    return this.$injector;
  }

  get<T>(token: ProviderToken<T> | string, notFoundValue?: T): T {
    const name = ReflectInjection.translate(token);

    if (notFoundValue !== undefined && !hasInAppInjector(this.$injector, name)) {
      return notFoundValue;
    }

    return getFromAppInjector(this.$injector, name) as T;
  }
}

/**
 * Desenvuelve un `Injector` público al `$injector` real de AngularJS —
 * borde entre la API pública (`Injector.get(token)`) y código interno del
 * runtime (`create-component.ts`) que necesita la API nativa completa. Solo
 * `InjectorImpl` sabe desenvolverse; cualquier otra implementación de
 * `Injector` (no debería haber otra hoy) no tiene forma de darnos un
 * `$injector` real.
 */
export function unwrapAngularInjector(injector: Injector): angular.auto.IInjectorService {
  if (injector instanceof InjectorImpl) return injector.nativeInjector;
  throw new Error("unwrapAngularInjector: este Injector no envuelve un $injector real de AngularJS");
}
