import { describe, expect, it } from "vitest";
import { getInjectFlags, Host, Optional, Self, SkipSelf } from "@/core/di/inject-flags.ts";

describe("etapa 5 — @Self/@SkipSelf/@Host/@Optional", () => {
  it("anota el flag correspondiente en la posición del parámetro", () => {
    class Widget {
      constructor(
        @Self() public a: unknown,
        @SkipSelf() public b: unknown,
        @Host() public c: unknown,
        @Optional() public d: unknown,
      ) {}
    }

    expect(getInjectFlags(Widget, 0)).toEqual({ self: true });
    expect(getInjectFlags(Widget, 1)).toEqual({ skipSelf: true });
    expect(getInjectFlags(Widget, 2)).toEqual({ host: true });
    expect(getInjectFlags(Widget, 3)).toEqual({ optional: true });
  });

  it("se pueden combinar varios flags en el mismo parámetro", () => {
    class Widget {
      constructor(@Self() @Optional() public a: unknown) {}
    }

    expect(getInjectFlags(Widget, 0)).toEqual({ self: true, optional: true });
  });

  it("un parámetro sin decorar no tiene flags", () => {
    class Widget {
      constructor(public a: unknown) {}
    }

    expect(getInjectFlags(Widget, 0)).toEqual({});
  });
});
