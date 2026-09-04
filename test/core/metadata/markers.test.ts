import { describe, expect, it } from "vitest";
import { EventEmitter } from "@/event-emitter.ts";
import { InputMarker, ModelMarker, OutputMarker, bindings, input, model, output } from "@/core/metadata/markers.ts";

describe("etapa 4 — input()/output()/bindings()", () => {
  it("input(defaultValue) devuelve un InputMarker no-required con ese default", () => {
    const marker = input(0);
    expect(marker).toBeInstanceOf(InputMarker);
    expect(marker.defaultValue).toBe(0);
    expect(marker.required).toBe(false);
  });

  it("input.required() devuelve un InputMarker required, sin default", () => {
    const marker = input.required<string>();
    expect(marker.required).toBe(true);
    expect(marker.defaultValue).toBeUndefined();
  });

  it("output() devuelve un OutputMarker", () => {
    expect(output()).toBeInstanceOf(OutputMarker);
  });

  it("bindings({...}) deja static bindings con los mismos marcadores", () => {
    const defs = { count: input(0), countChange: output<number>() };
    class Counter extends bindings(defs) {}

    expect(Counter.bindings).toBe(defs);
  });

  it("una clase extendida de bindings() se instancia y funciona en runtime, con tipos inferidos", () => {
    class Counter extends bindings({ count: input(0), step: input.required<number>(), countChange: output<number>() }) {
      inc() {
        this.count += this.step; // TS: count y step son number, sin declararlos aparte
        this.countChange.emit(this.count); // TS: countChange es EventEmitter<number>
      }
    }

    const c = new Counter();
    c.count = 5;
    c.step = 2;
    // en runtime real, esto lo asigna el bridge de $controller (etapa 5) a partir
    // del binding '&' de AngularJS — acá lo simulamos a mano, todavía no existe.
    c.countChange = new EventEmitter<number>();

    let emitted: number | undefined;
    c.countChange.subscribe((v) => {
      emitted = v;
    });
    c.inc();

    expect(c.count).toBe(7);
    expect(emitted).toBe(7);
    expect(c.countChange).toBeInstanceOf(EventEmitter);
  });

  it("bindings() no requiere output — inputs solos funcionan igual", () => {
    class Config extends bindings({ apiUrl: input("") }) {}
    const c = new Config();
    c.apiUrl = "https://x";
    expect(c.apiUrl).toBe("https://x");
  });

  it("model(defaultValue) devuelve un ModelMarker no-required con ese default", () => {
    const marker = model(0);
    expect(marker).toBeInstanceOf(ModelMarker);
    expect(marker.defaultValue).toBe(0);
    expect(marker.required).toBe(false);
  });

  it("model.required() devuelve un ModelMarker required, sin default", () => {
    const marker = model.required<string>();
    expect(marker.required).toBe(true);
    expect(marker.defaultValue).toBeUndefined();
  });

  it("bindings() con model() da this.total: T directo, sin propiedad Change aparte", () => {
    class Widget extends bindings({ total: model(0) }) {
      inc() {
        this.total += 1; // TS: total es number, sin declararlo aparte
      }
    }

    const w = new Widget();
    w.total = 5;
    w.inc();
    expect(w.total).toBe(6);
  });
});
