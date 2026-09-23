import "reflect-metadata";
import "zone.js";
import { describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

describe("ngjs-core/runtime — inject() de una directiva/componente ancestro por token de clase", () => {
  it("un hijo recibe la instancia del componente padre vía inject(ParentClass)", async () => {
    let seenParent: unknown = "no seteado";

    @Component({ selector: "di-parent", controllerAs: "$", template: "<di-child></di-child>" })
    class Parent {
      readonly tag = "soy-el-parent";
    }

    @Component({ selector: "di-child", controllerAs: "$", template: "x" })
    class Child {
      private readonly parent = inject<Parent>(Parent);

      $onInit(): void {
        seenParent = this.parent;
      }
    }

    @NgModule({ declarations: [Parent, Child] })
    class AppModule {}

    const host = document.createElement("di-parent");
    document.body.appendChild(host);
    const appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(seenParent).toBeInstanceOf(Parent);
    expect((seenParent as Parent).tag).toBe("soy-el-parent");

    appRef.destroy();
  });

  it("sin ancestro de ese tipo, inject(ParentClass, { optional: true }) devuelve null", async () => {
    let seen: unknown = "no seteado";

    @Component({ selector: "di-lonely-parent", controllerAs: "$", template: "<di-lonely-child></di-lonely-child>" })
    class LonelyParent {}

    @Component({ selector: "di-other", controllerAs: "$", template: "y" })
    class Other {}

    @Component({ selector: "di-lonely-child", controllerAs: "$", template: "x" })
    class LonelyChild {
      private readonly other = inject<Other>(Other, { optional: true });

      $onInit(): void {
        seen = this.other;
      }
    }

    @NgModule({ declarations: [LonelyParent, Other, LonelyChild] })
    class AppModule {}

    const host = document.createElement("di-lonely-parent");
    document.body.appendChild(host);
    const appRef = await bootstrapApplication(AppModule, { hostElement: host });

    expect(seen).toBeNull();

    appRef.destroy();
  });
});
