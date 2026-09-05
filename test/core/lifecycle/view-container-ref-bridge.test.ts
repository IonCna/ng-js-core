import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerViewContainerRef } from "@/runtime/bridges/view-container-ref-bridge.ts";
import { ViewContainerRef, ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 6 — ViewContainerRef wiring contra $controller real", () => {
  it("inyecta un ViewContainerRef por-instancia, anclado al $element real", () => {
    const name = uniqueName("vcrBridgeTest");
    angular.module(name, []).decorator("$controller", decorateControllerViewContainerRef).component("widget", {
      template: "ok",
      controller: class {
        static $inject = [ViewContainerRef.$name];
        vcr: ViewContainerRef;
        constructor(vcr: ViewContainerRef) {
          this.vcr = vcr;
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as Element;
    const ctrl = angular.element(widgetEl).controller("widget") as { vcr: ViewContainerRefImpl };

    expect(ctrl.vcr).toBeInstanceOf(ViewContainerRefImpl);
    expect(ctrl.vcr.element.nativeElement).toBe(widgetEl);
  });

  it("dos instancias del mismo componente reciben cada una su propio ViewContainerRef", () => {
    const name = uniqueName("vcrBridgeTestTwo");
    angular.module(name, []).decorator("$controller", decorateControllerViewContainerRef).component("widget", {
      template: "ok",
      controller: class {
        static $inject = [ViewContainerRef.$name];
        vcr: ViewContainerRef;
        constructor(vcr: ViewContainerRef) {
          this.vcr = vcr;
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget><widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const [first, second] = Array.from(host.querySelectorAll("widget"));
    const ctrl1 = angular.element(first).controller("widget") as { vcr: ViewContainerRef };
    const ctrl2 = angular.element(second).controller("widget") as { vcr: ViewContainerRef };

    expect(ctrl1.vcr).not.toBe(ctrl2.vcr);
  });
});
