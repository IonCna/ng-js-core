import { describe, expect, it } from "vitest";
import { Directive, directive, getDirectiveDef } from "@/core/metadata/directive.ts";

describe("etapa 4 — directive() / @Directive", () => {
  it("directive(Clase).define(def) estampa el DirectiveDef en la clase", () => {
    class Foo {}
    directive(Foo).define({ selector: "[foo]", exportAs: "foo" });

    expect(getDirectiveDef(Foo)).toEqual({ selector: "[foo]", exportAs: "foo", inputs: [], outputs: [] });
  });

  it("@Directive(def) produce el mismo DirectiveDef que directive(Clase).define(def)", () => {
    const def = { selector: "[bar]" };

    @Directive(def)
    class Bar {}

    class BarJs {}
    directive(BarJs).define(def);

    expect(getDirectiveDef(Bar)).toEqual(getDirectiveDef(BarJs));
  });

  it("getDirectiveDef devuelve undefined si la clase nunca pasó por directive()/@Directive", () => {
    class SinDef {}
    expect(getDirectiveDef(SinDef)).toBeUndefined();
  });
});
