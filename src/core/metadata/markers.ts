import type { EventEmitter } from "@/event-emitter.ts";

/**
 * `input()`/`output()` no viven como field initializer de instancia — eso
 * necesitaría instanciar la clase para detectarlos (la sonda que descartamos
 * por frágil). Se usan dentro de `bindings({...})`, que corre una sola vez,
 * al definir la clase.
 */
export class InputMarker<T> {
  constructor(
    public readonly defaultValue: T | undefined,
    public readonly required: boolean,
  ) {}
}

export class OutputMarker<T> {
  readonly _phantom?: T; // sin uso en runtime, ayuda a que TS infiera T
}

/**
 * Binding de dos vías — AngularJS ya lo tiene nativo (`'='`), así que no hace
 * falta sintetizar un output/EventEmitter aparte como en el `model()` de
 * signals de Angular real: una sola entrada, AngularJS sincroniza los dos
 * lados solo.
 */
export class ModelMarker<T> {
  constructor(
    public readonly defaultValue: T | undefined,
    public readonly required: boolean,
  ) {}
}

export function input<T>(defaultValue?: T): InputMarker<T> {
  return new InputMarker(defaultValue, false);
}

input.required = <T>(): InputMarker<T> => new InputMarker<T>(undefined, true);

export function output<T = void>(): OutputMarker<T> {
  return new OutputMarker<T>();
}

export function model<T>(defaultValue?: T): ModelMarker<T> {
  return new ModelMarker(defaultValue, false);
}

model.required = <T>(): ModelMarker<T> => new ModelMarker<T>(undefined, true);

type BindingsMap = Record<string, InputMarker<unknown> | OutputMarker<unknown> | ModelMarker<unknown>>;

/**
 * Arma una clase base con `static bindings = defs` y el tipo de instancia
 * calculado a partir de esos mismos marcadores — sin nada nuevo en runtime,
 * solo para que TS sepa que `this.count` es `number` sin declararlo aparte.
 */
export function bindings<B extends BindingsMap>(defs: B) {
  type Instance = {
    [K in keyof B]: B[K] extends InputMarker<infer T>
      ? T
      : B[K] extends ModelMarker<infer T>
        ? T
        : B[K] extends OutputMarker<infer T>
          ? EventEmitter<T>
          : never;
  };

  class Base {
    static bindings = defs;
  }

  // `as unknown as` en vez de intersecar con `typeof Base`: `typeof Base` trae su
  // propia firma de constructor (`new (): Base`) que choca con la que queremos acá
  // (`new (): Instance`) — TS tira "Base constructors must all have the same
  // return type" si quedan las dos.
  return Base as unknown as { new (): Instance; bindings: B };
}
