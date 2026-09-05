import type { NgModuleDef } from "@/core/metadata/def.ts";

export type StampedNgModuleDef = Required<Pick<NgModuleDef, "id" | "declarations" | "imports" | "providers">>;

interface WithNgModuleDef {
  ɵmod?: StampedNgModuleDef;
  $name?: string;
}

/**
 * Deriva un nombre de `angular.module` estable para una clase `@NgModule` que no
 * declara `id`. La identidad es la clase (como en Angular real); el nombre sale de
 * `Clase.name`, y si dos clases distintas colisionan en ese nombre se desempata
 * con un sufijo incremental. Es una clase (no un contador suelto) para poder
 * resetear el estado en tests si hiciera falta.
 */
class ModuleNameRegistry {
  private readonly byClass = new WeakMap<Function, string>();
  private readonly used = new Map<string, number>();

  nameFor(Clase: Function): string {
    const cached = this.byClass.get(Clase);
    if (cached) return cached;

    const base = Clase.name || "NgModule";
    const seen = this.used.get(base) ?? 0;
    this.used.set(base, seen + 1);
    const name = seen === 0 ? base : `${base}_${seen}`;
    this.byClass.set(Clase, name);
    return name;
  }
}

const moduleNames = new ModuleNameRegistry();

export function stampNgModuleDef(Clase: Function, def: NgModuleDef): Function {
  const id = def.id ?? moduleNames.nameFor(Clase);
  const target = Clase as WithNgModuleDef;
  target.ɵmod = {
    id,
    declarations: def.declarations ?? [],
    imports: def.imports ?? [],
    providers: def.providers ?? [],
  };
  target.$name = id;
  return Clase;
}

export function getNgModuleDef(Clase: Function): StampedNgModuleDef | undefined {
  return (Clase as WithNgModuleDef).ɵmod;
}

/** Piel JS: `ngModule(Clase).define(def)`. */
export function ngModule(Clase: Function): { define(def: NgModuleDef): Function } {
  return {
    define(def: NgModuleDef): Function {
      return stampNgModuleDef(Clase, def);
    },
  };
}

/** Piel TS: `@NgModule(def)`. */
export function NgModule(def: NgModuleDef): ClassDecorator {
  return (Clase) => {
    stampNgModuleDef(Clase, def);
  };
}
