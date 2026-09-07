import { applyConstructorInject } from "@/core/di/ctor-inject.ts";
import { getInjectableId, setInjectableId } from "@/core/di/injectable-registry.ts";
import { collectBindings, collectHost } from "@/core/metadata/collect-bindings.ts";
import type { ComponentDef } from "@/core/metadata/def.ts";
import { stampComponentDef } from "@/core/metadata/define-component.ts";
import { parseSelector, selectorToRegistrationName } from "@/core/metadata/selector-name.ts";
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
      // Un componente de selector de atributo/compuesto (`[ngbNavOutlet]`,
      // `button[ngbNavLink]`) registra vía `.directive()` con `controller` real
      // (ver `directive-definition.ts`) — ahí `expression` YA es la clase, no
      // hace falta este rodeo por tagName, y de hecho no podría: el tagName del
      // host no identifica a un componente de atributo (cualquier tag lo puede
      // llevar). El registro por tagName solo tiene sentido para selectores de
      // elemento (`.component()`, único por elemento).
      if (parseSelector(def.selector).restrict === "E") {
        SelectorRegistry.register(def.selector, Clase);
      }
      // `id` inyectable = selector en camelCase — así un descendiente puede
      // `inject(MiComponente)` y recibir la instancia ancestro (DI a nivel
      // directiva, como Angular). Un `static $name` propio manda y no se pisa.
      if (!getInjectableId(Clase) && !Object.hasOwn(Clase, "$name")) {
        setInjectableId(Clase, selectorToRegistrationName(def.selector));
      }
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
