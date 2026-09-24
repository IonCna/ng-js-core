import { describe, expect, it } from "vitest";
import { mergeStaticData } from "@/router/route-title.ts";

/** Porta de la parte de unidad de `old/test/router/router-params-inheritance.test.ts`. */
describe("ngjs-core/router — mergeStaticData (unidad)", () => {
  const chain = [
    { name: "group", data: { shell: true } },
    { name: "group.wrapper", data: { own: 1 } },
  ];

  it("'always': mergea toda la cadena, el más profundo gana en choques", () => {
    const merged = mergeStaticData(
      [
        { name: "a", data: { x: 1, shared: "a" } },
        { name: "a.b", data: { y: 2, shared: "b" } },
      ],
      new Set(),
      "always",
    );
    expect(merged).toEqual({ x: 1, y: 2, shared: "b" });
  });

  it("'emptyOnly': no hereda si la hoja tiene path propio (no está en emptyPathStates)", () => {
    expect(mergeStaticData(chain, new Set(), "emptyOnly")).toEqual({ own: 1 });
  });

  it("'emptyOnly': hereda del padre mientras la hoja (y cada ancestro subido) tenga path vacío", () => {
    expect(mergeStaticData(chain, new Set(["group.wrapper"]), "emptyOnly")).toEqual({ shell: true, own: 1 });
  });

  it("'emptyOnly': corta la herencia en el primer ancestro con path propio no vacío", () => {
    const threeDeep = [
      { name: "root", data: { r: 1 } },
      { name: "root.mid", data: { m: 1 } }, // path propio no vacío — no está en emptyPathStates
      { name: "root.mid.leaf", data: { l: 1 } },
    ];
    expect(mergeStaticData(threeDeep, new Set(), "emptyOnly")).toEqual({ l: 1 });
  });
});
