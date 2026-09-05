import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import type { PipeTransform } from "@/pipes/pipe-transform.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

describe("ngjs-core/runtime — @Directive y @Pipe declarados en @NgModule", () => {
  it("una @Directive de atributo con controller + un @Pipe corren en el template", async () => {
    @Directive({ selector: "[mark-upper]", restrict: "A" })
    class MarkUpper {
      static readonly $inject = ["$element"];
      constructor($element: angular.IAugmentedJQuery) {
        ($element[0] as HTMLElement).dataset.marked = "yes";
      }
    }

    @Pipe({ name: "exclaim" })
    class ExclaimPipe implements PipeTransform {
      transform(value: unknown): string {
        return `${value}!`;
      }
    }

    @Component({
      selector: "decl-root",
      controllerAs: "$",
      template: "<b mark-upper>{{ $.name | exclaim }}</b>",
    })
    class Root {
      name = "hola";
    }

    @NgModule({ declarations: [Root, MarkUpper, ExclaimPipe] })
    class AppModule {}

    const host = document.createElement("decl-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    const b = host.querySelector("b") as HTMLElement;
    expect(b.textContent).toBe("hola!");
    expect(b.dataset.marked).toBe("yes");
    appRef.destroy();
  });

  it("un @NgModule anidado exporta sus declarables al que lo importa", async () => {
    @Component({ selector: "shared-badge", controllerAs: "$", template: "<em>badge</em>" })
    class SharedBadge {}

    @NgModule({ declarations: [SharedBadge] })
    class SharedModule {}

    @Component({ selector: "nest-root", template: "<shared-badge></shared-badge>" })
    class Root {}

    @NgModule({ imports: [SharedModule], declarations: [Root] })
    class AppModule {}

    const host = document.createElement("nest-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(host.querySelector("em")?.textContent).toBe("badge");
    appRef.destroy();
  });
});
