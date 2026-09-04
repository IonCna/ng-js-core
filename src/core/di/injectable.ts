import { ensureInject, type InjectionEntry } from "@/core/di/reflect.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

const injectOverrides = new WeakMap<Function, Map<number, InjectionEntry>>();

/**
 * Piel JS — la parte pública para consumidores sin decoradores. `ensureInject`
 * es un primitivo interno (lo usan `injectable()`, `Injectable()`, y el
 * registro de providers); esta es la función que se documenta/exporta.
 */
export function injectable<T extends object>(target: T): T {
  ensureInject(target);
  return target;
}

/**
 * Decorador de parámetro de ctor. Corre UNA VEZ, al definir la clase — no
 * puede resolver nada por su cuenta. Solo anota `{ índice, token }`; el valor
 * lo termina poniendo `$inject` nativo + `$injector.instantiate`, por
 * instancia, como cualquier parámetro de ctor. Hace falta para los casos que
 * `design:paramtypes` no puede resolver solo (primitivos → `String`/`Number`,
 * interfaces → `Object`).
 */
export function Inject(token: ProviderToken<unknown> | string): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    // en un parámetro de ctor, `target` ya es la clase (no el prototype)
    const ctor = target as unknown as Function;
    let overrides = injectOverrides.get(ctor);
    if (!overrides) {
      overrides = new Map();
      injectOverrides.set(ctor, overrides);
    }
    overrides.set(parameterIndex, token);
  };
}

function getDesignParamTypes(target: Function): unknown[] {
  const withMetadata = Reflect as unknown as {
    getMetadata?: (key: string, target: Function) => unknown;
  };
  if (typeof withMetadata.getMetadata !== "function") return [];
  return (withMetadata.getMetadata("design:paramtypes", target) as unknown[] | undefined) ?? [];
}

/**
 * Arma `$inject` a partir de `design:paramtypes` (requiere TS +
 * `emitDecoratorMetadata`), pisando por índice con lo que haya anotado
 * `@Inject`. Sin `reflect-metadata`/metadata emitida, corre sobre una lista
 * vacía — equivalente a una clase sin ctor deps declaradas acá (usá
 * `static $inject`/`inject()` en ese caso).
 */
export function Injectable(_config?: { providedIn?: "root" }): ClassDecorator {
  return (target) => {
    const ctor = target as unknown as Function;
    const paramTypes = getDesignParamTypes(ctor);
    const overrides = injectOverrides.get(ctor);

    const entries: InjectionEntry[] = paramTypes.map(
      (paramType, index) => (overrides?.get(index) ?? paramType) as InjectionEntry,
    );

    (ctor as unknown as { $inject?: readonly InjectionEntry[] }).$inject = entries;
    injectable(ctor); // @Injectable llama a la piel JS de fondo, como @Component -> component()
  };
}
