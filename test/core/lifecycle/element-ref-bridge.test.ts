import angular from "angular";
import { describe, expect, it } from "vitest";
import { ensureInject } from "@/core/di/reflect.ts";
import { decorateControllerElementRef } from "@/core/lifecycle/element-ref-bridge.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 5 — ElementRef vía locals", () => {
  it("un ctor que pide ElementRef lo recibe, apuntando al $element real de esa instancia", () => {
    class Widget {
      static $inject = [ElementRef];
      constructor(public elRef: ElementRef) {}
    }
    ensureInject(Widget);

    const name = uniqueName("elementRefTest");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerElementRef)
      .component("widget", { template: "ok", controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as Element;
    const controller = angular.element(widgetEl).controller("widget") as Widget;

    expect(controller.elRef).toBeInstanceOf(ElementRef);
    expect(controller.elRef.nativeElement).toBe(widgetEl);
  });

  it("dos instancias del mismo componente reciben cada una su propio ElementRef", () => {
    class Widget {
      static $inject = [ElementRef];
      constructor(public elRef: ElementRef) {}
    }
    ensureInject(Widget);

    const name = uniqueName("elementRefTestTwo");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerElementRef)
      .component("widget", { template: "ok", controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget><widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const [first, second] = Array.from(host.querySelectorAll("widget"));
    const ctrl1 = angular.element(first).controller("widget") as Widget;
    const ctrl2 = angular.element(second).controller("widget") as Widget;

    expect(ctrl1.elRef.nativeElement).toBe(first);
    expect(ctrl2.elRef.nativeElement).toBe(second);
    expect(ctrl1.elRef).not.toBe(ctrl2.elRef);
  });

  it("un componente que no pide ElementRef sigue funcionando normal", () => {
    const name = uniqueName("elementRefTestUnused");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerElementRef)
      .component("widget", { template: "ok", controller: class {} });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    expect(() => angular.bootstrap(host, [name], { strictDi: false })).not.toThrow();
  });
});
