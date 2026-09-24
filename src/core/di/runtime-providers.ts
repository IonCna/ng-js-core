import type angular from "angular";
import { resolveForwardRef } from "@/core/di/forward-ref.ts";
import { injectionTokenName } from "@/core/di/injector.ts";
import type { Provider } from "@/core/di/provider.ts";

type ProviderRecord = {
  provide?: unknown;
  useValue?: unknown;
  useClass?: Function;
  useFactory?: (...args: unknown[]) => unknown;
  useExisting?: unknown;
  deps?: unknown[];
  multi?: boolean;
};

type CompiledClass = Function & { ɵfac?: unknown[]; ɵprov?: { factory?: unknown[] } };

/**
 * Registra `providers` que llegan como VALORES en runtime (no como texto fuente que lea el compilador): los de una
 * ruta (`Route.providers`). Mismas reglas que el compilado (`ModuleWithProvidersRuntime`): el nombre de DI sale de
 * `ɵprov.token` (un string, tal cual) y una clase se construye con su `ɵfac` propio. En AngularJS hay un solo
 * injector: quedan registrados para toda la app.
 */
export class RuntimeProviders {
  static register($provide: angular.auto.IProvideService, providers: readonly Provider[]): void {
    const flat = (providers as unknown[]).flat(Number.POSITIVE_INFINITY) as (Function | ProviderRecord)[];
    const multi = new Map<string, ProviderRecord[]>();
    for (const raw of flat) {
      const provider: ProviderRecord = typeof raw === "function" ? { provide: raw } : raw;
      const name = RuntimeProviders.nameOf(provider.provide);
      if (provider.multi) multi.set(name, [...(multi.get(name) ?? []), provider]);
      else $provide.factory(name, RuntimeProviders.factoryOf(provider, typeof raw === "function") as never);
    }
    for (const [name, group] of multi) {
      const factories = group.map((provider) => RuntimeProviders.factoryOf(provider, false));
      $provide.factory(name, [
        "$injector",
        ($injector: angular.auto.IInjectorService) => factories.map((factory) => $injector.invoke(factory as never)),
      ]);
    }
  }

  private static nameOf(token: unknown): string {
    return injectionTokenName(resolveForwardRef(token) as never);
  }

  private static factoryOf(provider: ProviderRecord, bare: boolean): unknown[] {
    const deps = (provider.deps ?? []).map((dep) => RuntimeProviders.nameOf(dep));
    if ("useValue" in provider) return [() => provider.useValue];
    if (provider.useFactory) return [...deps, provider.useFactory];
    if (provider.useExisting) return [RuntimeProviders.nameOf(provider.useExisting), (existing: unknown) => existing];

    const type = resolveForwardRef(provider.useClass ?? provider.provide) as CompiledClass;
    if (typeof type !== "function") throw new Error("provider sin receta y sin clase en `provide`.");
    if (provider.deps) return [...deps, (...args: unknown[]) => Reflect.construct(type, args)];
    if (bare && Object.hasOwn(type, "ɵprov") && type.ɵprov?.factory) return type.ɵprov.factory;
    if (Object.hasOwn(type, "ɵfac")) return type.ɵfac!;
    if (type.ɵfac) throw new Error(`"${type.name}" hereda el factory de su clase padre — agregale @Injectable().`);
    return [() => Reflect.construct(type, [])];
  }
}
