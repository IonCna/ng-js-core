import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { commonModule } from "@/runtime/common/index.ts";
import { ChangeDetectorRef } from "@/core/change-detection/change-detector-ref.ts";
import { configureCore } from "@/runtime/core-module.ts";
import { ViewContainerRef } from "@/core/refs/view-container-ref.ts";
import { NgZoneFactory } from "@/core/platform/digest-bridge.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

/** Prepara `ng.js.core` como lo hace `PlatformRef`: con una instancia de `NgZone`. */
function coreName(): string {
  return configureCore(NgZoneFactory.create());
}

describe("CoreModule/CommonModule", () => {
  it("registra bridges per-instance de CoreModule", () => {
    class Widget {
      static readonly $inject = [ChangeDetectorRef.$name, ViewContainerRef.$name];

      constructor(
        public readonly cdr: ChangeDetectorRef,
        public readonly vcr: ViewContainerRef,
      ) {}
    }

    const name = uniqueName("coreModule");
    angular.module(name, [coreName()]).component("widget", { template: "ok", controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("widget") as Element).controller("widget") as Widget;
    expect(ctrl.cdr).toBeInstanceOf(ChangeDetectorRef);
    expect(ctrl.vcr).toBeInstanceOf(ViewContainerRef);
  });

  it("CommonModule importa CoreModule y registra ng-template + ng-template-outlet", () => {
    // CommonModule declara `imports: [CoreModule]`, así que su grafo ya trae core;
    // solo falta la constante NgZone que aporta el bootstrap real.
    configureCore(NgZoneFactory.create());

    const name = uniqueName("commonModule");
    angular.module(name, [commonModule().name]).component("widget", {
      template:
        '<ng-template ng-ref="$ctrl.tpl" let-item="$implicit"><span>{{item}}</span></ng-template>' +
        '<div ng-template-outlet="$ctrl.tpl" ng-template-outlet-context="{$implicit: \'ok\'}"></div>',
      controller: class {
        tpl?: unknown;
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.querySelector("span")?.textContent).toBe("ok");
  });
});
