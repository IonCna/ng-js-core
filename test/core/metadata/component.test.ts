import { describe, expect, it } from "vitest";
import { Component, component } from "@/core/metadata/component.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { Input } from "@/core/metadata/input.ts";
import { bindings, input, model, output } from "@/core/metadata/markers.ts";
import { Model } from "@/core/metadata/model.ts";
import { Output } from "@/core/metadata/output.ts";
import { EventEmitter } from "@/event-emitter.ts";

describe("etapa 4 — component() / @Component", () => {
  it("component(Clase).define(def) estampa el ComponentDef en la clase, con inputs/outputs vacíos si no hay", () => {
    class Foo {
      inc() {}
    }

    component(Foo).define({ selector: "foo", template: "hola" });

    expect(getComponentDef(Foo)).toEqual({ selector: "foo", template: "hola", inputs: [], outputs: [] });
  });

  it("@Component(def) produce el mismo ComponentDef que component(Clase).define(def)", () => {
    const def = { selector: "baz", template: "{{ $.count }}" };

    @Component(def)
    class Baz {}

    class BazJs {}
    component(BazJs).define(def);

    expect(getComponentDef(Baz)).toEqual(getComponentDef(BazJs));
  });

  it("getComponentDef devuelve undefined si la clase nunca pasó por component()/@Component", () => {
    class SinDef {}
    expect(getComponentDef(SinDef)).toBeUndefined();
  });

  it("component(Clase).define(def) devuelve la misma clase (para poder encadenar/exportar)", () => {
    class Foo {}
    const result = component(Foo).define({ selector: "foo" });
    expect(result).toBe(Foo);
  });

  it("junta los @Input/@Output de la clase al registrar (TS)", () => {
    class Counter {
      @Input() count!: number;
      @Output() countChange!: unknown;
    }

    component(Counter).define({ selector: "counter" });

    expect(getComponentDef(Counter)).toEqual({
      selector: "counter",
      inputs: [{ propName: "count", bindingName: "count", required: undefined, transform: undefined }],
      outputs: [{ propName: "countChange", bindingName: "countChange" }],
    });
  });

  it("@Output() con un EventEmitter real: la metadata se junta y emit/subscribe funcionan en la instancia", () => {
    class Counter {
      @Input() count = 0;
      @Output() countChange = new EventEmitter<number>();

      inc() {
        this.count += 1;
        this.countChange.emit(this.count);
      }
    }

    component(Counter).define({ selector: "counter" });

    expect(getComponentDef(Counter)!.outputs).toEqual([{ propName: "countChange", bindingName: "countChange" }]);

    const c = new Counter();
    expect(c.countChange).toBeInstanceOf(EventEmitter);

    let emitted: number | undefined;
    c.countChange.subscribe((v) => {
      emitted = v;
    });
    c.inc();

    expect(emitted).toBe(1);
  });

  it("junta static bindings (JS, input()/output()) al registrar", () => {
    class Counter extends bindings({ count: input(0), countChange: output<number>() }) {}

    component(Counter).define({ selector: "counter" });

    const def = getComponentDef(Counter)!;
    expect(def.inputs).toEqual([{ propName: "count", bindingName: "count", required: false }]);
    expect(def.outputs).toEqual([{ propName: "countChange", bindingName: "countChange" }]);
  });

  it("model()/@Model producen un input con twoWay: true, sin output aparte", () => {
    class WidgetJs extends bindings({ total: model(0) }) {}
    component(WidgetJs).define({ selector: "widget-js" });

    expect(getComponentDef(WidgetJs)).toEqual({
      selector: "widget-js",
      inputs: [{ propName: "total", bindingName: "total", required: false, twoWay: true }],
      outputs: [],
    });

    class WidgetTs {
      @Model() total!: number;
    }
    component(WidgetTs).define({ selector: "widget-ts" });

    expect(getComponentDef(WidgetTs)).toEqual({
      selector: "widget-ts",
      inputs: [{ propName: "total", bindingName: "total", required: undefined, twoWay: true }],
      outputs: [],
    });
  });
});
