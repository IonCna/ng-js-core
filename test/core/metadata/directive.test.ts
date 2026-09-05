import { describe, expect, it } from "vitest";
import { Directive, directive, getDirectiveDef } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { bindings, input, output } from "@/core/metadata/markers.ts";
import { Output } from "@/core/metadata/output.ts";

describe("etapa 4 — directive() / @Directive", () => {
  it("directive(Clase).define(def) estampa el DirectiveDef en la clase", () => {
    class Foo {}
    directive(Foo).define({ selector: "[foo]", exportAs: "foo" });

    expect(getDirectiveDef(Foo)).toEqual({
      selector: "[foo]",
      exportAs: "foo",
      inputs: [],
      outputs: [],
      host: { bindings: [], listeners: [] },
    });
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

  it("directive() junta @Input/@Output reales al registrar (TS)", () => {
    class Highlight {
      @Input() color!: string;
      @Output() colorChange!: unknown;
    }

    directive(Highlight).define({ selector: "[highlight]" });

    expect(getDirectiveDef(Highlight)).toEqual({
      selector: "[highlight]",
      inputs: [{ propName: "color", bindingName: "color", required: undefined, transform: undefined }],
      outputs: [{ propName: "colorChange", bindingName: "colorChange" }],
      host: { bindings: [], listeners: [] },
    });
  });

  it("directive() junta static bindings (JS) al registrar", () => {
    class Highlight extends bindings({ color: input(""), colorChange: output<string>() }) {}

    directive(Highlight).define({ selector: "[highlight]" });

    const def = getDirectiveDef(Highlight)!;
    expect(def.inputs).toEqual([{ propName: "color", bindingName: "color", required: false }]);
    expect(def.outputs).toEqual([{ propName: "colorChange", bindingName: "colorChange" }]);
  });
});
