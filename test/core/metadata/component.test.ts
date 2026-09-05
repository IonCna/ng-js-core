import { describe, expect, it } from "vitest";
import { Component, component } from "@/core/metadata/component.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { HostListener } from "@/core/metadata/host-listener.ts";
import { Input } from "@/core/metadata/input.ts";
import { bindings, hostListener, input, model, output } from "@/core/metadata/markers.ts";
import { Model } from "@/core/metadata/model.ts";
import { Output } from "@/core/metadata/output.ts";
import { EventEmitter } from "@/event-emitter.ts";

describe("etapa 4 — component() / @Component", () => {
  it("component(Clase).define(def) estampa el ComponentDef en la clase, con inputs/outputs vacíos si no hay", () => {
    class Foo {
      inc() {}
    }

    component(Foo).define({ selector: "foo", template: "hola" });

    expect(getComponentDef(Foo)).toEqual({
      selector: "foo",
      template: "hola",
      inputs: [],
      outputs: [],
      host: { bindings: [], listeners: [] },
    });
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
      host: { bindings: [], listeners: [] },
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
      host: { bindings: [], listeners: [] },
    });

    class WidgetTs {
      @Model() total!: number;
    }
    component(WidgetTs).define({ selector: "widget-ts" });

    expect(getComponentDef(WidgetTs)).toEqual({
      selector: "widget-ts",
      inputs: [{ propName: "total", bindingName: "total", required: undefined, twoWay: true }],
      outputs: [],
      host: { bindings: [], listeners: [] },
    });
  });

  it("mezcla static bindings (JS) y @Input/@Output (TS) en la misma clase sin pisarse", () => {
    class Widget extends bindings({ count: input(0) }) {
      @Input() step!: number;
      @Output() countChange!: unknown;
    }

    component(Widget).define({ selector: "widget" });

    const def = getComponentDef(Widget)!;
    expect(def.inputs.map((i) => i.propName).sort()).toEqual(["count", "step"]);
    expect(def.outputs.map((o) => o.propName)).toEqual(["countChange"]);
  });

  it("@Model mezclado con @Input/@Output normales en la misma clase", () => {
    class Widget {
      @Model() total!: number;
      @Input() label!: string;
      @Output() done!: unknown;
    }

    component(Widget).define({ selector: "widget" });

    const def = getComponentDef(Widget)!;
    expect(def.inputs).toContainEqual(expect.objectContaining({ propName: "total", twoWay: true }));
    expect(def.inputs).toContainEqual(expect.objectContaining({ propName: "label" }));
    expect(def.outputs).toEqual([{ propName: "done", bindingName: "done" }]);
  });

  it("un valor que no es InputMarker/OutputMarker/ModelMarker en static bindings se ignora en silencio", () => {
    class Rara {
      static bindings = { count: "no soy un marker" as unknown as ReturnType<typeof input> };
    }

    component(Rara).define({ selector: "rara" });

    expect(getComponentDef(Rara)).toEqual({
      selector: "rara",
      inputs: [],
      outputs: [],
      host: { bindings: [], listeners: [] },
    });
  });

  it("una subclase sin decorar hereda el ɵcmp del padre decorado (es una propiedad static)", () => {
    @Component({ selector: "padre" })
    class Padre {}

    class Hijo extends Padre {}

    expect(getComponentDef(Hijo)).toEqual(getComponentDef(Padre));
  });

  it("registrar la misma clase dos veces pisa limpio, sin arrastrar el def anterior", () => {
    class Foo {
      @Input() a!: string;
    }

    component(Foo).define({ selector: "foo-v1" });
    expect(getComponentDef(Foo)!.selector).toBe("foo-v1");
    expect(getComponentDef(Foo)!.inputs).toEqual([{ propName: "a", bindingName: "a", required: undefined, transform: undefined }]);

    component(Foo).define({ selector: "foo-v2", template: "v2" });

    expect(getComponentDef(Foo)).toEqual({
      selector: "foo-v2",
      template: "v2",
      // el bucket de @Input es por prototype, no se limpia entre registros: sigue apareciendo
      inputs: [{ propName: "a", bindingName: "a", required: undefined, transform: undefined }],
      outputs: [],
      host: { bindings: [], listeners: [] },
    });
  });

  it("junta static hostListeners (JS, hostListener()) al registrar", () => {
    class Widget {
      static hostListeners = { onClick: hostListener("click"), onKeydown: hostListener("keydown", ["$event"]) };
      onClick() {}
      onKeydown() {}
    }

    component(Widget).define({ selector: "widget" });

    const listeners = getComponentDef(Widget)!.host!.listeners!;
    expect(listeners).toContainEqual({ methodName: "onClick", eventName: "click", args: undefined });
    expect(listeners).toContainEqual({ methodName: "onKeydown", eventName: "keydown", args: ["$event"] });
  });

  it("mezcla @HostListener (TS) y static hostListeners (JS) en la misma clase sin pisarse", () => {
    class Widget {
      static hostListeners = { onKeydown: hostListener("keydown") };

      @HostListener("click")
      onClick() {}
      onKeydown() {}
    }

    component(Widget).define({ selector: "widget" });

    const listeners = getComponentDef(Widget)!.host!.listeners!;
    expect(listeners.map((l) => l.eventName).sort()).toEqual(["click", "keydown"]);
  });
});
