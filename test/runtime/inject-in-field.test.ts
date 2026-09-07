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

  it("respeta { optional: true } (null si no hay provider) y { skipSelf: true } (salta locals del elemento)", async () => {
    let optionalWasNull = false;
    let skipSelfElementRef: unknown = "no seteado";

    @Component({ selector: "inj-child3", controllerAs: "$", template: "x" })
    class Child {
      private readonly missing = inject<Greeter>(Greeter, { optional: true });
      private readonly ownElementRef = inject(ElementRef, { skipSelf: true, optional: true });

      $onInit(): void {
        optionalWasNull = this.missing === null;
        skipSelfElementRef = this.ownElementRef;
      }
    }

    @Component({ selector: "inj-root3", controllerAs: "$", template: "<inj-child3></inj-child3>" })
    class Root {}

    // Sin `providers: [Greeter]` — el inject opcional debe devolver null en vez de tirar.
    @NgModule({ declarations: [Root, Child] })
    class AppModule {}

    const host = document.createElement("inj-root3");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(optionalWasNull).toBe(true);
    // `skipSelf` salta el ElementRef local de este elemento; no hay uno arriba → null (optional).
    expect(skipSelfElementRef).toBeNull();

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
