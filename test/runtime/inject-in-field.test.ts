import "reflect-metadata";
import "zone.js";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { inject } from "@/core/di/inject.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

@Injectable()
class Greeter {
  hi(): string {
    return "hola";
  }
}

describe("ngjs-core/runtime — inject() en field initializer (estilo ng-bootstrap)", () => {
  it("resuelve un servicio de app y el ElementRef por-instancia, sin static $inject", async () => {
    let seen = "";

    @Component({ selector: "inj-child", controllerAs: "$", template: "<span>{{ $.text }}</span>" })
    class Child {
      private readonly greeter = inject(Greeter);
      private readonly elementRef = inject(ElementRef);
      text = "";

      $onInit(): void {
        this.text = `${this.greeter.hi()}:${(this.elementRef.nativeElement as HTMLElement).tagName.toLowerCase()}`;
        seen = this.text;
      }
    }

    @Component({ selector: "inj-root", controllerAs: "$", template: "<inj-child></inj-child>" })
    class Root {}

    @NgModule({ declarations: [Root, Child], providers: [Greeter] })
    class AppModule {}

    const host = document.createElement("inj-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(seen).toBe("hola:inj-child");
    expect(host.querySelector("inj-child span")?.textContent).toBe("hola:inj-child");

    appRef.destroy();
  });

  it("fuera de una construcción, inject() sigue usando el Injector global", async () => {
    @Component({ selector: "inj-root2", controllerAs: "$", template: "x" })
    class Root {}
    @NgModule({ declarations: [Root], providers: [Greeter] })
    class AppModule {}

    const host = document.createElement("inj-root2");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(inject(Greeter).hi()).toBe("hola");
    appRef.destroy();
  });
});
