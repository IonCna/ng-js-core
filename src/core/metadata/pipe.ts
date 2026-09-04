import type { PipeDef } from "@/core/metadata/def.ts";

interface WithPipeDef {
  ɵpipe?: PipeDef;
}

export function stampPipeDef(Clase: Function, def: PipeDef): Function {
  (Clase as WithPipeDef).ɵpipe = def;
  return Clase;
}

export function getPipeDef(Clase: Function): PipeDef | undefined {
  return (Clase as WithPipeDef).ɵpipe;
}

/** Piel JS — `pipe(Clase).define(def)`, mismo patrón que `component()`. */
export function pipe(Clase: Function): { define(def: PipeDef): Function } {
  return {
    define(def: PipeDef): Function {
      return stampPipeDef(Clase, { pure: true, ...def });
    },
  };
}

/** Piel TS — azúcar sobre `pipe()`. */
export function Pipe(def: PipeDef): ClassDecorator {
  return (Clase) => {
    pipe(Clase).define(def);
  };
}
