import { describe, expect, it } from "vitest";
import { I18nPluralPipe } from "@/pipes/i18n-plural.ts";
import { I18nSelectPipe } from "@/pipes/i18n-select.ts";
import { SlicePipe } from "@/pipes/slice.ts";

describe("etapa 11 — slice (unidad, sin AngularJS)", () => {
  it("corta arreglos y strings como Array/String#slice, con negativos", () => {
    const pipe = new SlicePipe();
    expect(pipe.transform([1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
    expect(pipe.transform([1, 2, 3, 4], -2)).toEqual([3, 4]);
    expect(pipe.transform("abcdef", 0, 3)).toBe("abc");
    expect(pipe.transform(null, 0)).toBeNull();
  });

  it("mismo arreglo y rango sin cambios → misma referencia (sin loop de digest); si cambia, una nueva", () => {
    const pipe = new SlicePipe();
    const list = [1, 2, 3];
    const first = pipe.transform(list, 0, 2);
    expect(pipe.transform(list, 0, 2)).toBe(first);
    expect(pipe.transform(list, 1)).not.toBe(first);
    list[0] = 9;
    expect(pipe.transform(list, 0, 2)).toEqual([9, 2]);
  });

  it("lo que no es arreglo ni string es error", () => {
    expect(() => new SlicePipe().transform({} as unknown as string, 0)).toThrowError(/InvalidPipeArgument/);
  });
});

describe("etapa 11 — i18nPlural / i18nSelect (unidad, sin AngularJS)", () => {
  const plural = { "=0": "Sin pedidos", one: "# pedido", other: "# pedidos" };

  it("i18nPlural: primero el valor exacto, después la categoría del locale; # es el número", () => {
    const pipe = new I18nPluralPipe("es-MX");
    expect(pipe.transform(0, plural)).toBe("Sin pedidos");
    expect(pipe.transform(1, plural)).toBe("1 pedido");
    expect(pipe.transform(5, plural)).toBe("5 pedidos");
    expect(pipe.transform(null, plural)).toBe("");
  });

  it("i18nPlural: sin mensaje para la categoría ni other, error", () => {
    expect(() => new I18nPluralPipe("es-MX").transform(5, { one: "#" })).toThrowError(/No plural message/);
  });

  it("i18nSelect: el texto del valor, o el de other, o vacío", () => {
    const pipe = new I18nSelectPipe();
    const mapping = { pending: "Pendiente", other: "Sin estado" };
    expect(pipe.transform("pending", mapping)).toBe("Pendiente");
    expect(pipe.transform("x", mapping)).toBe("Sin estado");
    expect(pipe.transform("x", { pending: "Pendiente" })).toBe("");
    expect(pipe.transform(null, mapping)).toBe("");
  });
});
