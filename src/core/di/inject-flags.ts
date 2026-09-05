export interface InjectFlags {
  self?: boolean;
  skipSelf?: boolean;
  host?: boolean;
  optional?: boolean;
}

const flagsByCtor = new WeakMap<Function, Map<number, InjectFlags>>();

function mergeFlag(ctor: Function, parameterIndex: number, flag: InjectFlags): void {
  let byIndex = flagsByCtor.get(ctor);
  if (!byIndex) {
    byIndex = new Map();
    flagsByCtor.set(ctor, byIndex);
  }
  byIndex.set(parameterIndex, { ...byIndex.get(parameterIndex), ...flag });
}

/** Lee los flags anotados en un parámetro de ctor — `{}` si no tiene ninguno. */
export function getInjectFlags(ctor: Function, parameterIndex: number): InjectFlags {
  return flagsByCtor.get(ctor)?.get(parameterIndex) ?? {};
}

/** Solo mira el `cache`/`providers` de este nodo — no sube a `parent` ni cae al `$injector` de la app. */
export function Self(): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    mergeFlag(target as unknown as Function, parameterIndex, { self: true });
  };
}

/** Arranca la búsqueda en `parent` — salta el `cache`/`providers` propio del nodo. */
export function SkipSelf(): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    mergeFlag(target as unknown as Function, parameterIndex, { skipSelf: true });
  };
}

/** Como el default, pero no cruza hacia `parent`: si no está en este nodo, cae directo al `$injector` de la app. */
export function Host(): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    mergeFlag(target as unknown as Function, parameterIndex, { host: true });
  };
}

/** Si no se encuentra nada, devuelve `null` en vez de lanzar. */
export function Optional(): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    mergeFlag(target as unknown as Function, parameterIndex, { optional: true });
  };
}
