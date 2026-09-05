import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { HostBinding } from "@/core/metadata/host-binding.ts";
import { HostListener } from "@/core/metadata/host-listener.ts";
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
      hostBindings: [],
      hostListeners: [],
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
    expect(collectMetadata(SinNada.prototype)).toEqual({ inputs: [], outputs: [], hostBindings: [], hostListeners: [] });
  });

  it("@Model() anota un input con twoWay: true, sin tocar outputs", () => {
    class Foo {
      @Model() total!: number;
    }

    expect(collectMetadata(Foo.prototype)).toEqual({
      inputs: [{ propName: "total", bindingName: "total", required: undefined, twoWay: true }],
      outputs: [],
      hostBindings: [],
      hostListeners: [],
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

describe("etapa 5 — @HostListener / bucket por prototype", () => {
  it("@HostListener(event) anota methodName/eventName, sin args", () => {
    class Foo {
      @HostListener("click")
      onClick() {}
    }

    expect(collectMetadata(Foo.prototype).hostListeners).toEqual([
      { methodName: "onClick", eventName: "click", args: undefined },
    ]);
  });

  it("@HostListener(event, args) guarda los args", () => {
    class Foo {
      @HostListener("click", ["$event"])
      onClick() {}
    }

    expect(collectMetadata(Foo.prototype).hostListeners).toEqual([
      { methodName: "onClick", eventName: "click", args: ["$event"] },
    ]);
  });

  it("varios @HostListener en la misma clase se acumulan todos", () => {
    class Foo {
      @HostListener("click")
      onClick() {}
      @HostListener("keydown")
      onKeydown() {}
    }

    const { hostListeners } = collectMetadata(Foo.prototype);
    expect(hostListeners.map((l) => l.eventName).sort()).toEqual(["click", "keydown"]);
  });

  it("una subclase funde los @HostListener del padre con los propios", () => {
    class Base {
      @HostListener("click")
      onClick() {}
    }
    class Child extends Base {
      @HostListener("keydown")
      onKeydown() {}
    }

    const { hostListeners } = collectMetadata(Child.prototype);
    expect(hostListeners.map((l) => l.methodName).sort()).toEqual(["onClick", "onKeydown"]);
  });
});

describe("etapa 5 — @HostBinding / bucket por prototype", () => {
  it("@HostBinding(hostProperty) anota propName/hostProperty", () => {
    class Foo {
      @HostBinding("class.active") isActive!: boolean;
    }

    expect(collectMetadata(Foo.prototype).hostBindings).toEqual([{ propName: "isActive", hostProperty: "class.active" }]);
  });

  it("varios @HostBinding en la misma clase se acumulan todos", () => {
    class Foo {
      @HostBinding("class.active") isActive!: boolean;
      @HostBinding("style.color") color!: string;
    }

    const { hostBindings } = collectMetadata(Foo.prototype);
    expect(hostBindings.map((b) => b.propName).sort()).toEqual(["color", "isActive"]);
  });

  it("una subclase funde los @HostBinding del padre con los propios", () => {
    class Base {
      @HostBinding("class.active") isActive!: boolean;
    }
    class Child extends Base {
      @HostBinding("style.color") color!: string;
    }

    const { hostBindings } = collectMetadata(Child.prototype);
    expect(hostBindings.map((b) => b.propName).sort()).toEqual(["color", "isActive"]);
  });
});
