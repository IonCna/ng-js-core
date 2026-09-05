import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { CommonModule } from "@/common/common-module.ts";
import { CoreModule } from "@/core/core-module.ts";
import { ChangeDetectorRef } from "@/core/change-detection/change-detector-ref.ts";
import { ViewContainerRef } from "@/core/refs/view-container-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
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
    angular.module(name, [CoreModule.name]).component("widget", { template: "ok", controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("widget") as Element).controller("widget") as Widget;
    expect(ctrl.cdr).toBeInstanceOf(ChangeDetectorRef);
    expect(ctrl.vcr).toBeInstanceOf(ViewContainerRef);
  });

  it("CommonModule registra ng-template + ng-template-outlet", () => {
    const name = uniqueName("commonModule");
    angular.module(name, [CommonModule.name]).component("widget", {
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
