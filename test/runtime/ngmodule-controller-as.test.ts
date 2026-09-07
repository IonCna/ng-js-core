import "reflect-metadata";
import "zone.js";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

function textOf(host: Element, selector: string): string {
  return (host.querySelector(selector)?.textContent ?? "").trim();
}

describe("ngjs-core/runtime — controllerAs por @NgModule (3 capas)", () => {
  it("del @NgModule cuando el @Component no lo declara; el @Component gana si lo pone; hereda por imports", async () => {
    // Nieto en un módulo SIN controllerAs → hereda "$" del que lo importa.
    @Component({ selector: "ca-grandchild", template: "<span>{{ $.v }}</span>" })
    class Grandchild {
      v = "gc";
    }
    @NgModule({ id: "ca.grand", declarations: [Grandchild] })
    class GrandModule {}

    // Componente en el módulo raíz: sin controllerAs → toma "$" del módulo.
    @Component({ selector: "ca-child", template: "<span>{{ $.v }}</span>" })
    class Child {
      v = "c";
    }
    // Componente que SÍ declara su propio controllerAs → gana sobre el del módulo.
    @Component({ selector: "ca-own", controllerAs: "vm", template: "<span>{{ vm.v }}</span>" })
    class Own {
      v = "own";
    }

    @Component({
      selector: "ca-root",
      controllerAs: "$",
      template: "<ca-child></ca-child><ca-own></ca-own><ca-grandchild></ca-grandchild>",
    })
    class Root {}

    @NgModule({
      id: "ca.root",
      controllerAs: "$",
      imports: [GrandModule],
      declarations: [Root, Child, Own],
    })
    class AppModule {}

    const host = document.createElement("ca-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(textOf(host, "ca-child span")).toBe("c"); // "$" del módulo
    expect(textOf(host, "ca-own span")).toBe("own"); // "vm" propio del componente
    expect(textOf(host, "ca-grandchild span")).toBe("gc"); // "$" heredado por imports

    appRef.destroy();
  });

  it("sin controllerAs en ningún lado → $ctrl (default nativo)", async () => {
    @Component({ selector: "ca2-child", template: "<span>{{ $ctrl.v }}</span>" })
    class Child {
      v = "d";
    }
    @Component({ selector: "ca2-root", template: "<ca2-child></ca2-child>" })
    class Root {}
    @NgModule({ id: "ca2.root", declarations: [Root, Child] })
    class AppModule {}

    const host = document.createElement("ca2-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(textOf(host, "ca2-child span")).toBe("d");
    appRef.destroy();
  });
});
