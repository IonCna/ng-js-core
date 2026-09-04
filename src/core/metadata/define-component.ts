import type { ComponentDef, InputDef, OutputDef } from "@/core/metadata/def.ts";

/**
 * El `def` autorado (lo que el consumidor pasa a `.define()`) no trae
 * `inputs`/`outputs` — esos se calculan solos (`@Input`/`@Output`, `bindings()`)
 * y se agregan recién acá, en el objeto que queda estampado.
 */
export type StampedComponentDef = ComponentDef & { inputs: InputDef[]; outputs: OutputDef[] };

/**
 * Stamp de más bajo nivel: pega el `def` a la clase y nada más. No es una
 * segunda entrada pública para el consumidor — eso es `component(Clase).define(def)`
 * (`component.ts`), que además arma `inputs`/`outputs` antes de llegar acá.
 */
interface WithComponentDef {
  ɵcmp?: StampedComponentDef;
}

export function stampComponentDef(Clase: Function, def: StampedComponentDef): Function {
  (Clase as WithComponentDef).ɵcmp = def;
  return Clase;
}

export function getComponentDef(Clase: Function): StampedComponentDef | undefined {
  return (Clase as WithComponentDef).ɵcmp;
}
