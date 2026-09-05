import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";
import { configureTestingModule } from "@/runtime/testing/index.ts";

describe("ngjs-core/runtime", () => {
  it("bootstrapModuleRuntime registra el grafo del @NgModule y arranca", async () => {
    @Injectable()
    class Greeter {
      greet() {
        return "hola";
      }
    }

    @Component({ selector: "runtime-root", controllerAs: "$", template: "<span>{{ $.msg }}</span>" })
    class RuntimeRoot {
      msg: string;
      constructor(greeter: Greeter) {
        this.msg = greeter.greet();
      }
    }

    @NgModule({ imports: [CommonModule], declarations: [RuntimeRoot], providers: [Greeter] })
    class AppModule {}

    const host = document.createElement("runtime-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(host.querySelector("span")?.textContent).toBe("hola");
    appRef.destroy();
  });

  it("configureTestingModule expone el módulo para angular.mock.module", () => {
    @Component({ selector: "mock-widget", controllerAs: "$", template: "<b>{{ $.n }}</b>" })
    class MockWidget {
      n = 42;
    }

    @NgModule({ imports: [CommonModule], declarations: [MockWidget] })
    class FeatureModule {}

    const name = configureTestingModule({ imports: [FeatureModule] });

    let compiled = "";
    angular.mock.module(name);
    angular.mock.inject((_$compile_: angular.ICompileService, _$rootScope_: angular.IRootScopeService) => {
      const el = _$compile_("<mock-widget></mock-widget>")(_$rootScope_.$new() as angular.IScope);
      _$rootScope_.$digest();
      compiled = (el[0] as HTMLElement).textContent ?? "";
    });

    expect(compiled).toBe("42");
  });
});
