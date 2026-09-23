import type angular from "angular";
import { getInjectFlags, type InjectFlags } from "@/core/di/inject-flags.ts";
import { runInInjectionContext } from "@/core/di/injection-context.ts";
import { Injector } from "@/core/di/injector.ts";
import type { Provider } from "@/core/di/provider.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";
import { ensureInject, ReflectInjection } from "@/core/di/reflect.ts";
import { getFromAppInjector, hasInAppInjector } from "@/core/di/root-singleton-registry.ts";
import { assertNotServiceProvider } from "@/core/di/service.ts";

type SingleProvider = Exclude<Provider, Provider[]>;

const NOT_FOUND = Symbol("ngjs-not-found");

/** Clave de jqLite `data()` donde vive el `ElementInjectorNode` de un elemento (la misma que usan los bridges). */
export const ELEMENT_INJECTOR_DATA_KEY = "$ngjsInjector";

function isTypeProvider(provider: SingleProvider): provider is Extract<SingleProvider, Function> {
  return typeof provider === "function";
}

/**
 * Contenedor chico, paralelo al `$injector`, anclado a un elemento del árbol
 * de componentes (ver CONCEPTOS "Inyector jerárquico"). Uno se crea por cada
 * componente/directiva que declare `providers`; el resto de los descendientes
 * reusan el del ancestro más cercano (anclaje real vía jqLite `$element.data()`,
 * en `scoped-injector-bridge.ts` — esta clase no sabe nada del DOM).
 *
 * `environment`: el nodo de entorno de la rama lazy (`loadChildren` → `@NgModule`)
 * a la que pertenece el elemento — con los `providers` del módulo lazy. Como en
 * Angular, se busca primero en toda la cadena de elementos y recién después en el
 * environment injector (en vez del `$injector` de la app). Un nodo de entorno es
 * un `ElementInjectorNode` más: su `parent` es el entorno de la rama lazy ancestro.
 */
export class ElementInjectorNode {
  private readonly singles = new Map<string, SingleProvider>();
  private readonly multis = new Map<string, SingleProvider[]>();
  private readonly cache = new Map<string, unknown>();
  /**
   * Instancias vivas publicadas por las directivas/componentes de ESTE elemento
   * (clave = selector en camelCase). No entran al barrido de `destroy()`: su
   * `ngOnDestroy` lo maneja el `lifecycle-bridge`, no el inyector.
   */
  private readonly instances = new Map<string, unknown>();
  /** `true` en el nodo de entorno de una rama lazy (lo crea `NgModuleScopes.createForState`). */
  private isEnvironment = false;

  /** Nodo de entorno de una rama lazy: `providers` de sus `@NgModule`, hijo del entorno ancestro. */
  static environment(
    providers: Provider[],
    parent: ElementInjectorNode | undefined,
    $injector: angular.auto.IInjectorService,
  ): ElementInjectorNode {
    const node = new ElementInjectorNode(providers, parent, $injector);
    node.isEnvironment = true;
    return node;
  }

  constructor(
    providers: Provider[],
    private readonly parent: ElementInjectorNode | undefined,
    private readonly $injector: angular.auto.IInjectorService,
    readonly environment?: ElementInjectorNode,
  ) {
    const flat = (providers as unknown[]).flat(Infinity) as SingleProvider[];
    for (const provider of flat) {
      const token = isTypeProvider(provider) ? provider : provider.provide;
      const name = ReflectInjection.translate(token);

      if (!isTypeProvider(provider) && provider.multi) {
        this.multis.set(name, [...(this.multis.get(name) ?? []), provider]);
      } else {
        this.singles.set(name, provider);
      }
    }
  }

  get<T>(token: unknown, flags: InjectFlags = {}): T {
    return this.resolve(ReflectInjection.translate(token as never), flags) as T;
  }

  /** Publica una directiva/componente de este elemento como token inyectable para los descendientes. */
  registerInstance(name: string, value: unknown): void {
    this.instances.set(name, value);
  }

  /** Llamar en `$scope.$on('$destroy', ...)` — `ngOnDestroy` de todo lo cacheado en este nodo. */
  destroy(): void {
    for (const value of this.cache.values()) {
      for (const instance of Array.isArray(value) ? value : [value]) {
        (instance as { ngOnDestroy?: () => void } | null)?.ngOnDestroy?.();
      }
    }
    this.cache.clear();
  }

  /** Resolución con un `environment` explícito — para `NodeInjector`, que conserva el de quien lo pidió. */
  resolveIn(name: string, flags: InjectFlags, environment: ElementInjectorNode | undefined): unknown {
    return this.resolve(name, flags, environment);
  }

  /** `environment`: el del nodo que originó la búsqueda — se mantiene al subir por los padres. */
  private resolve(name: string, flags: InjectFlags, environment = this.environment): unknown {
    // `Injector` dentro de una rama lazy: uno que resuelve con ESTA cadena (elemento →
    // entorno de la rama → app), no el global — `injector.get(ServicioLazy)` funciona.
    // Fuera de una rama se deja el comportamiento de siempre (el `Injector` de la app).
    if (name === Injector.$name && !flags.skipSelf && (environment || this.isEnvironment)) {
      return new NodeInjector(this, environment ?? this, this.$injector);
    }

    if (!flags.skipSelf) {
      const own = this.resolveOwn(name);
      if (own !== NOT_FOUND) return own;
      if (flags.self) return this.notFound(name, flags);
    }

    // `host`: no cruza el borde de este nodo hacia arriba — cae directo al entorno / $injector de la app.
    if (!flags.host && this.parent) {
      // Hacia arriba no aplican `self`/`skipSelf`/`host` (posicionales), pero `optional` sí.
      return this.parent.resolve(name, { optional: flags.optional }, environment);
    }

    if (environment) return environment.get(name, { optional: flags.optional });
    return this.fromAppInjector(name, flags);
  }

  private resolveOwn(name: string): unknown {
    if (this.instances.has(name)) return this.instances.get(name);
    if (this.cache.has(name)) return this.cache.get(name);

    if (this.multis.has(name)) {
      const resolved = this.multis.get(name)!.map((provider) => this.instantiate(provider));
      this.cache.set(name, resolved);
      return resolved;
    }

    if (this.singles.has(name)) {
      const resolved = this.instantiate(this.singles.get(name)!);
      this.cache.set(name, resolved);
      return resolved;
    }

    return NOT_FOUND;
  }

  private fromAppInjector(name: string, flags: InjectFlags): unknown {
    if (hasInAppInjector(this.$injector, name)) return getFromAppInjector(this.$injector, name);
    return this.notFound(name, flags);
  }

  private notFound(name: string, flags: InjectFlags): unknown {
    if (flags.optional) return null;
    throw new Error(`ElementInjectorNode: no se encontró un provider para "${name}"`);
  }

  private instantiate(provider: SingleProvider): unknown {
    if (isTypeProvider(provider)) return this.construct(provider);
    if ("useValue" in provider) return provider.useValue;
    if ("useClass" in provider) return this.construct(provider.useClass);

    if ("useFactory" in provider) {
      const args = (provider.deps ?? []).map((dep) => this.get(dep));
      return provider.useFactory(...(args as never[]));
    }

    if ("useExisting" in provider) return this.get(provider.useExisting);

    // ConstructorProvider: `provide` es la propia clase, `deps` son sus argumentos de ctor.
    return this.construct(provider.provide as unknown as Function, provider.deps);
  }

  private construct(ctor: Function, deps?: readonly unknown[]): unknown {
    assertNotServiceProvider(ctor);
    const names = deps ? deps.map((dep) => ReflectInjection.translate(dep as never)) : ensureInject(ctor);
    const args = names.map((name, index) => this.resolve(name, deps ? {} : getInjectFlags(ctor, index)));
    // `inject()` en field initializers del provider resuelve contra ESTE nodo (y su entorno).
    return runInInjectionContext({ get: (token, options) => this.get(token, options) }, () =>
      Reflect.construct(ctor as new (...a: unknown[]) => unknown, args),
    );
  }
}

/**
 * `Injector` público respaldado por la cadena de un `ElementInjectorNode` (Angular:
 * `NodeInjector`/`R3Injector` de la rama). `nativeInjector` sigue siendo el
 * `$injector` de la app, para el código del runtime que necesita la API nativa.
 */
export class NodeInjector extends Injector {
  /**
   * `node`: el nodo desde donde se resuelve. `environment`: el entorno de la rama —
   * si `node` es él mismo el entorno, se pasa igual (así `createComponent` sabe
   * anclar el host a esta rama).
   */
  constructor(
    readonly node: ElementInjectorNode,
    readonly environment: ElementInjectorNode,
    readonly nativeInjector: angular.auto.IInjectorService,
  ) {
    super();
  }

  get<T>(token: ProviderToken<T> | string, notFoundValue?: T): T {
    const name = ReflectInjection.translate(token);
    const env = this.node === this.environment ? undefined : this.environment;
    if (notFoundValue === undefined) return this.node.resolveIn(name, {}, env) as T;
    const found = this.node.resolveIn(name, { optional: true }, env);
    return (found ?? notFoundValue) as T;
  }
}
