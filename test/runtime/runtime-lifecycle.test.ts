import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import type { OnChanges, OnDestroy, OnInit } from "@/core/lifecycle/interfaces.ts";
import { Component } from "@/core/metadata/component.ts";
import { Input } from "@/core/metadata/input.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
// biome-ignore lint/style/useImportType: valor en runtime — lo lee `design:paramtypes` (emitDecoratorMetadata)
import { ElementRef } from "@/core/refs/element-ref.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

describe("ngjs-core/runtime — bridge de lifecycle + ElementRef por ctor", () => {
  it("ngOnInit/ngOnChanges/ngOnDestroy se reenvían y ElementRef se inyecta", async () => {
    const calls: string[] = [];

    @Component({ selector: "life-child", controllerAs: "$", template: "<span>{{ $.value }}</span>" })
    class Child implements OnInit, OnChanges, OnDestroy {
      @Input() value = "";
      private tag: string;

      constructor(el: ElementRef<HTMLElement>) {
        this.tag = el.nativeElement.tagName.toLowerCase();
      }

      ngOnInit(): void {
        calls.push(`init:${this.tag}`);
      }
      ngOnChanges(): void {
        calls.push(`changes:${this.value}`);
      }
      ngOnDestroy(): void {
        calls.push("destroy");
      }
    }

    @Component({
      selector: "life-root",
      controllerAs: "$",
      template: '<life-child ng-if="$.show" value="$.v"></life-child>',
    })
    class Root {
      show = true;
      v = "one";
    }

    @NgModule({ declarations: [Root, Child] })
    class AppModule {}

    const host = document.createElement("life-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const $rootScope = (appRef.injector as angular.auto.IInjectorService).get<angular.IRootScopeService>("$rootScope");
    const root = angular.element(host).controller("lifeRoot") as Root;

    expect(host.querySelector("span")?.textContent).toBe("one");
    expect(calls).toContain("init:life-child");
    expect(calls).toContain("changes:one");

    root.v = "two";
    $rootScope.$digest();
    expect(calls).toContain("changes:two");

    root.show = false;
    $rootScope.$digest();
    expect(calls).toContain("destroy");

    appRef.destroy();
  });
});
