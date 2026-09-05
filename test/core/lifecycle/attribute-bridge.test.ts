import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { decorateControllerAttributes } from "@/runtime/bridges/attribute-bridge.ts";
import { Attribute } from "@/core/metadata/attribute.ts";
import { component } from "@/core/metadata/component.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 5 — @Attribute / $attr: wiring contra un atributo HTML real", () => {
  it("@Attribute('type') recibe el valor literal del atributo, no bindeado", () => {
    @Injectable()
    class Widget {
      constructor(@Attribute("type") public type: string) {}
    }
    component(Widget).define({ selector: "widget" });

    const name = uniqueName("attributeTest");
    angular.module(name, []).decorator("$controller", decorateControllerAttributes).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = '<widget type="checkbox"></widget>';
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as Element;
    const ctrl = angular.element(widgetEl).controller("widget") as Widget;

    expect(ctrl.type).toBe("checkbox");
  });

  it("JS puro (static $inject = ['$attr:nombre'], sin decorador) también funciona", () => {
    class Widget {
      static $inject = ["$attr:type"];
      constructor(public type: string) {}
    }
    component(Widget).define({ selector: "widget" });

    const name = uniqueName("attributeTestJs");
    angular.module(name, []).decorator("$controller", decorateControllerAttributes).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = '<widget type="radio"></widget>';
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as Element;
    const ctrl = angular.element(widgetEl).controller("widget") as Widget;

    expect(ctrl.type).toBe("radio");
  });

  it("no es reactivo: cambiar el atributo después no actualiza el valor ya inyectado", () => {
    @Injectable()
    class Widget {
      constructor(@Attribute("type") public type: string) {}
    }
    component(Widget).define({ selector: "widget" });

    const name = uniqueName("attributeTestStatic");
    angular.module(name, []).decorator("$controller", decorateControllerAttributes).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = '<widget type="checkbox"></widget>';
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const widgetEl = host.querySelector("widget") as Element;
    const ctrl = angular.element(widgetEl).controller("widget") as Widget;

    widgetEl.setAttribute("type", "radio");
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(ctrl.type).toBe("checkbox");
  });

  it("dos instancias del mismo componente reciben cada una su propio valor de atributo", () => {
    @Injectable()
    class Widget {
      constructor(@Attribute("type") public type: string) {}
    }
    component(Widget).define({ selector: "widget" });

    const name = uniqueName("attributeTestTwo");
    angular.module(name, []).decorator("$controller", decorateControllerAttributes).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = '<widget type="checkbox"></widget><widget type="radio"></widget>';
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const [first, second] = Array.from(host.querySelectorAll("widget"));
    const ctrl1 = angular.element(first).controller("widget") as Widget;
    const ctrl2 = angular.element(second).controller("widget") as Widget;

    expect(ctrl1.type).toBe("checkbox");
    expect(ctrl2.type).toBe("radio");
  });
});
