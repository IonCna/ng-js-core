import type angular from "angular";

/**
 * Singletons de app que NO pasan por `$injector` de AngularJS: `@Service`
 * (siempre) e `InjectionToken({ factory })` (si nadie más lo provee). AngularJS
 * no deja registrar un `.service()`/`.factory()` nuevo después del bootstrap
 * (`$injector.get`/`.has` solo ven lo que se declaró en fase `config`), así que
 * el cacheo de "una sola instancia para toda la app" lo hacemos acá — lazy,
 * construida recién la primera vez que alguien la pide, como `providedIn: 'root'`
 * en Angular real.
 */
export class RootSingletonRegistry {
  private static readonly factories = new Map<string, () => unknown>();
  private static readonly instances = new Map<string, unknown>();

  static register(name: string, factory: () => unknown): void {
    RootSingletonRegistry.factories.set(name, factory);
  }

  static has(name: string): boolean {
    return RootSingletonRegistry.factories.has(name);
  }

  static get(name: string): unknown {
    if (!RootSingletonRegistry.instances.has(name)) {
      const factory = RootSingletonRegistry.factories.get(name);
      if (!factory) throw new Error(`RootSingletonRegistry: no hay factory registrada para "${name}".`);
      RootSingletonRegistry.instances.set(name, factory());
    }
    return RootSingletonRegistry.instances.get(name);
  }

  /**
   * Descarta las instancias cacheadas (deja las factories). Cada `@Service`
   * `providedIn: 'root'` se reconstruye la próxima vez que se lo pide. Lo llama
   * el harness de testing entre tests: como el registry es global al proceso,
   * un `@Service` que en su ctor/field capturó `inject(ApplicationRef)` (u otra
   * dep de nivel app) quedaría con una referencia muerta al bootstrappear una
   * app nueva. Solo para tests — en runtime no se llama.
   */
  static reset(): void {
    RootSingletonRegistry.instances.clear();
  }
}

/**
 * `$injector.has`, con fallback a un root singleton (`@Service`,
 * `InjectionToken({ factory })`) cuando AngularJS no lo tiene registrado.
 * Único lugar con esta regla — la usan `InjectorImpl`, `ElementInjectorNode` y
 * el resolver de `inject()` sin nodo jerárquico, así los tres caminos de
 * resolución ven los mismos tokens.
 */
export function hasInAppInjector($injector: angular.auto.IInjectorService, name: string): boolean {
  return $injector.has(name) || RootSingletonRegistry.has(name);
}

/** `$injector.get`, con el mismo fallback que `hasInAppInjector`. */
export function getFromAppInjector($injector: angular.auto.IInjectorService, name: string): unknown {
  return $injector.has(name) ? $injector.get(name) : RootSingletonRegistry.get(name);
}
