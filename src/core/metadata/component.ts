import { applyConstructorInject } from "@/core/di/ctor-inject.ts";
import { collectBindings, collectHost } from "@/core/metadata/collect-bindings.ts";
import type { ComponentDef } from "@/core/metadata/def.ts";
import { stampComponentDef } from "@/core/metadata/define-component.ts";
import { SelectorRegistry } from "@/core/metadata/selector-registry.ts";

/**
 * Piel JS — `component(Clase).define(def)`. Se prefiere sobre `component(Clase, def)`
 * porque una clase no trivial (con `extends`, cuerpo largo) queda fea metida como
 * argumento de una función junto a un objeto de config aparte.
 */
export function component(Clase: Function): { define(def: ComponentDef): Function } {
  return {
    define(def: ComponentDef): Function {
      const { inputs, outputs } = collectBindings(Clase);
      const host = collectHost(Clase);
      applyConstructorInject(Clase);
      SelectorRegistry.register(def.selector, Clase);
      return stampComponentDef(Clase, { ...def, inputs, outputs, host });
    },
  };
}

/** Piel TS — azúcar sobre `component()`: `@Component(def) class Foo {}` ≡ `component(Foo).define(def)`. */
export function Component(def: ComponentDef): ClassDecorator {
  return (Clase) => {
    component(Clase).define(def);
  };
}
