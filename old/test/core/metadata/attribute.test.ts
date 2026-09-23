import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { ATTRIBUTE_TOKEN_PREFIX, Attribute } from "@/core/metadata/attribute.ts";

describe("etapa 5 — @Attribute", () => {
  it("anota un token sintético $attr:nombre en la posición del parámetro", () => {
    @Injectable()
    class Widget {
      constructor(@Attribute("type") public type: string) {}
    }

    expect((Widget as unknown as { $inject: string[] }).$inject).toEqual([`${ATTRIBUTE_TOKEN_PREFIX}type`]);
  });

  it("se combina con un ctor typed en otra posición", () => {
    class Dep {
      static readonly $name = "Dep";
    }

    @Injectable()
    class Widget {
      constructor(
        public dep: Dep,
        @Attribute("type") public type: string,
      ) {}
    }

    expect((Widget as unknown as { $inject: string[] }).$inject).toEqual(["Dep", `${ATTRIBUTE_TOKEN_PREFIX}type`]);
  });
});
