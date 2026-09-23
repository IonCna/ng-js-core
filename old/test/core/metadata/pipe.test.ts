import { describe, expect, it } from "vitest";
import { Pipe, getPipeDef, pipe } from "@/core/metadata/pipe.ts";

describe("etapa 4 — pipe() / @Pipe", () => {
  it("pipe(Clase).define(def) estampa el PipeDef, con pure: true por default", () => {
    class Foo {
      transform(v: unknown) {
        return v;
      }
    }
    pipe(Foo).define({ name: "foo" });

    expect(getPipeDef(Foo)).toEqual({ name: "foo", pure: true });
  });

  it("respeta pure: false si se declara explícito", () => {
    class Impuro {}
    pipe(Impuro).define({ name: "impuro", pure: false });

    expect(getPipeDef(Impuro)).toEqual({ name: "impuro", pure: false });
  });

  it("@Pipe(def) produce el mismo PipeDef que pipe(Clase).define(def)", () => {
    const def = { name: "bar" };

    @Pipe(def)
    class Bar {}

    class BarJs {}
    pipe(BarJs).define(def);

    expect(getPipeDef(Bar)).toEqual(getPipeDef(BarJs));
  });

  it("getPipeDef devuelve undefined si la clase nunca pasó por pipe()/@Pipe", () => {
    class SinDef {}
    expect(getPipeDef(SinDef)).toBeUndefined();
  });
});
