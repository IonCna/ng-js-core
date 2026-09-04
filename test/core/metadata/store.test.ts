import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { Input } from "@/core/metadata/input.ts";
import { Model } from "@/core/metadata/model.ts";
import { Output } from "@/core/metadata/output.ts";
import { collectMetadata } from "@/core/metadata/store.ts";

describe("etapa 4 — @Input / @Output / bucket por prototype", () => {
  it("@Input() sin opciones usa el propio nombre del campo como bindingName", () => {
    class Foo {
      @Input() count!: number;
    }

    expect(collectMetadata(Foo.prototype)).toEqual({
      inputs: [{ propName: "count", bindingName: "count", required: undefined, transform: undefined }],
      outputs: [],
    });
  });

  it("@Input({required: true}) y @Input('alias') se reflejan en el def", () => {
    class Foo {
      @Input({ required: true }) step!: number;
      @Input("apiUrlAlias") apiUrl!: string;
    }

    const { inputs } = collectMetadata(Foo.prototype);
    expect(inputs).toContainEqual(
      expect.objectContaining({ propName: "step", bindingName: "step", required: true }),
    );
    expect(inputs).toContainEqual(
      expect.objectContaining({ propName: "apiUrl", bindingName: "apiUrlAlias" }),
    );
  });

  it("@Output() sin alias usa el propio nombre del campo", () => {
    class Foo {
      @Output() countChange!: unknown;
    }

    expect(collectMetadata(Foo.prototype).outputs).toEqual([{ propName: "countChange", bindingName: "countChange" }]);
  });

  it("@Output('alias') usa el alias como bindingName", () => {
    class Foo {
      @Output("changed") countChange!: unknown;
    }

    expect(collectMetadata(Foo.prototype).outputs).toEqual([{ propName: "countChange", bindingName: "changed" }]);
  });

  it("una subclase funde los @Input/@Output del padre con los propios", () => {
    class Base {
      @Input() count!: number;
    }
    class Child extends Base {
      @Input() step!: number;
      @Output() countChange!: unknown;
    }

    const { inputs, outputs } = collectMetadata(Child.prototype);
    expect(inputs.map((i) => i.propName)).toEqual(["count", "step"]);
    expect(outputs.map((o) => o.propName)).toEqual(["countChange"]);
  });

  it("una clase sin ningún @Input/@Output da listas vacías", () => {
    class SinNada {}
    expect(collectMetadata(SinNada.prototype)).toEqual({ inputs: [], outputs: [] });
  });

  it("@Model() anota un input con twoWay: true, sin tocar outputs", () => {
    class Foo {
      @Model() total!: number;
    }

    expect(collectMetadata(Foo.prototype)).toEqual({
      inputs: [{ propName: "total", bindingName: "total", required: undefined, twoWay: true }],
      outputs: [],
    });
  });

  it("@Model('alias') y @Model({required: true}) funcionan igual que @Input", () => {
    class Foo {
      @Model("totalAlias") total!: number;
      @Model({ required: true }) step!: number;
    }

    const { inputs } = collectMetadata(Foo.prototype);
    expect(inputs).toContainEqual(
      expect.objectContaining({ propName: "total", bindingName: "totalAlias", twoWay: true }),
    );
    expect(inputs).toContainEqual(
      expect.objectContaining({ propName: "step", bindingName: "step", required: true, twoWay: true }),
    );
  });
});
