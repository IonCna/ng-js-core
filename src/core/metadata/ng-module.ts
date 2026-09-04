import type { NgModuleDef } from "@/core/metadata/def.ts";

interface WithNgModuleDef {
  ɵmod?: NgModuleDef;
}

export function stampNgModuleDef(Clase: Function, def: NgModuleDef): Function {
  (Clase as WithNgModuleDef).ɵmod = def;
  return Clase;
}

export function getNgModuleDef(Clase: Function): NgModuleDef | undefined {
  return (Clase as WithNgModuleDef).ɵmod;
}

/** Piel JS — `ngModule(Clase).define(def)`, mismo patrón que `component()`. */
export function ngModule(Clase: Function): { define(def: NgModuleDef): Function } {
  return {
    define(def: NgModuleDef): Function {
      return stampNgModuleDef(Clase, { declarations: [], imports: [], providers: [], ...def });
    },
  };
}

/** Piel TS — azúcar sobre `ngModule()`. */
export function NgModule(def: NgModuleDef): ClassDecorator {
  return (Clase) => {
    ngModule(Clase).define(def);
  };
}
