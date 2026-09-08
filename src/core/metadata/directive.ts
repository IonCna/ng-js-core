import { applyConstructorInject } from "@/core/di/ctor-inject.ts";
import { getInjectableId, setInjectableId } from "@/core/di/injectable-registry.ts";
import { collectBindings, collectHost } from "@/core/metadata/collect-bindings.ts";
import type { DirectiveDef, InputDef, OutputDef } from "@/core/metadata/def.ts";
import { exportAsRegistry } from "@/core/metadata/export-as-registry.ts";
import { selectorToRegistrationName } from "@/core/metadata/selector-name.ts";

export type StampedDirectiveDef = DirectiveDef & { inputs: InputDef[]; outputs: OutputDef[] };

interface WithDirectiveDef {
  ɵdir?: StampedDirectiveDef;
}

export function stampDirectiveDef(Clase: Function, def: StampedDirectiveDef): Function {
  (Clase as WithDirectiveDef).ɵdir = def;
  return Clase;
}

export function getDirectiveDef(Clase: Function): StampedDirectiveDef | undefined {
  return (Clase as WithDirectiveDef).ɵdir;
}

/** Piel JS — `directive(Clase).define(def)`, mismo patrón que `component()`. */
export function directive(Clase: Function): { define(def: DirectiveDef): Function } {
  return {
    define(def: DirectiveDef): Function {
      const { inputs, outputs } = collectBindings(Clase);
      const host = collectHost(Clase);
      applyConstructorInject(Clase);
      // `id` inyectable = selector en camelCase (sin corchetes de `[attr]`), la
      // misma clave con que se registra la directiva. Deja `inject(MiDir)` desde
      // un descendiente. Un `static $name` propio manda y no se pisa.
      if (!getInjectableId(Clase) && !Object.hasOwn(Clase, "$name")) {
        setInjectableId(Clase, selectorToRegistrationName(def.selector));
      }
      exportAsRegistry.register(def.exportAs, def.selector);
      return stampDirectiveDef(Clase, { ...def, inputs, outputs, host });
    },
  };
}

/** Piel TS — azúcar sobre `directive()`. */
export function Directive(def: DirectiveDef): ClassDecorator {
  return (Clase) => {
    directive(Clase).define(def);
  };
}
