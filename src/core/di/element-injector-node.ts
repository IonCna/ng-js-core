import type angular from "angular";
import { getInjectFlags, type InjectFlags } from "@/core/di/inject-flags.ts";
import { ensureInject, ReflectInjection } from "@/core/di/reflect.ts";
import type { Provider } from "@/core/di/provider.ts";

type SingleProvider = Exclude<Provider, Provider[]>;

const NOT_FOUND = Symbol("ngjs-not-found");

function isTypeProvider(provider: SingleProvider): provider is Extract<SingleProvider, Function> {
  return typeof provider === "function";
}

/**
 * Contenedor chico, paralelo al `$injector`, anclado a un elemento del árbol
 * de componentes (ver CONCEPTOS "Inyector jerárquico"). Uno se crea por cada
 * componente/directiva que declare `providers`; el resto de los descendientes
 * reusan el del ancestro más cercano (anclaje real vía jqLite `$element.data()`,
 * en `scoped-injector-bridge.ts` — esta clase no sabe nada del DOM).
 */
export class ElementInjectorNode {
  private readonly singles = new Map<string, SingleProvider>();
  private readonly multis = new Map<string, SingleProvider[]>();
  private readonly cache = new Map<string, unknown>();

  constructor(
    providers: Provider[],
    private readonly parent: ElementInjectorNode | undefined,
    private readonly $injector: angular.auto.IInjectorService,
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

  /** Llamar en `$scope.$on('$destroy', ...)` — `ngOnDestroy` de todo lo cacheado en este nodo. */
  destroy(): void {
    for (const value of this.cache.values()) {
      for (const instance of Array.isArray(value) ? value : [value]) {
        (instance as { ngOnDestroy?: () => void } | null)?.ngOnDestroy?.();
      }
    }
    this.cache.clear();
  }

  private resolve(name: string, flags: InjectFlags): unknown {
    if (!flags.skipSelf) {
      const own = this.resolveOwn(name);
      if (own !== NOT_FOUND) return own;
      if (flags.self) return this.notFound(name, flags);
    }

    // `host`: no cruza el borde de este nodo hacia arriba — cae directo al $injector de la app.
    if (!flags.host && this.parent) {
      return this.parent.resolve(name, {});
    }

    return this.fromAppInjector(name, flags);
  }

  private resolveOwn(name: string): unknown {
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
    if (this.$injector.has(name)) return this.$injector.get(name);
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
    const names = deps ? deps.map((dep) => ReflectInjection.translate(dep as never)) : ensureInject(ctor);
    const args = names.map((name, index) => this.resolve(name, deps ? {} : getInjectFlags(ctor, index)));
    return Reflect.construct(ctor as new (...a: unknown[]) => unknown, args);
  }
}
