import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerHostListeners } from "@/core/lifecycle/host-listener-bridge.ts";
import { Component, component } from "@/core/metadata/component.ts";
import { HostListener } from "@/core/metadata/host-listener.ts";
import { hostListener } from "@/core/metadata/markers.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("etapa 5 — @HostListener wiring contra el $element real", () => {
  it("un click real en el host dispara el método decorado", () => {
    const calls: MouseEvent[] = [];

    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostListener("click")
      onClick(event: MouseEvent) {
        calls.push(event);
      }
    }

    const name = uniqueName("hostListenerTest");
    angular.module(name, []).decorator("$controller", decorateControllerHostListeners).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as HTMLElement;
    widgetEl.dispatchEvent(new MouseEvent("click"));

    expect(calls.length).toBe(1);
  });

  it("dos instancias del mismo componente reciben eventos independientes", () => {
    const calls: string[] = [];

    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostListener("click")
      onClick() {
        calls.push("click");
      }
    }

    const name = uniqueName("hostListenerTestTwo");
    angular.module(name, []).decorator("$controller", decorateControllerHostListeners).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget><widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const [first] = Array.from(host.querySelectorAll("widget"));
    (first as HTMLElement).dispatchEvent(new MouseEvent("click"));

    expect(calls).toEqual(["click"]);
  });

  it("un componente sin @HostListener no explota y no engancha nada", () => {
    const name = uniqueName("hostListenerTestNone");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerHostListeners)
      .component("widget", { template: "ok", controller: class {} });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    expect(() => angular.bootstrap(host, [name], { strictDi: false })).not.toThrow();
  });

  it("varios @HostListener en la misma clase se enganchan todos", () => {
    const calls: string[] = [];

    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostListener("click")
      onClick() {
        calls.push("click");
      }
      @HostListener("keydown")
      onKeydown() {
        calls.push("keydown");
      }
    }

    const name = uniqueName("hostListenerTestMulti");
    angular.module(name, []).decorator("$controller", decorateControllerHostListeners).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as HTMLElement;
    widgetEl.dispatchEvent(new MouseEvent("click"));
    widgetEl.dispatchEvent(new KeyboardEvent("keydown"));

    expect(calls).toEqual(["click", "keydown"]);
  });

  it("JS puro (hostListener(), sin decoradores) también se cablea contra el $element real", () => {
    const calls: string[] = [];

    class Widget {
      static hostListeners = { onClick: hostListener("click") };
      onClick() {
        calls.push("click");
      }
    }
    component(Widget).define({ selector: "widget" });

    const name = uniqueName("hostListenerTestJs");
    angular.module(name, []).decorator("$controller", decorateControllerHostListeners).component("widget", {
      template: "ok",
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    const widgetEl = host.querySelector("widget") as HTMLElement;
    widgetEl.dispatchEvent(new MouseEvent("click"));

    expect(calls).toEqual(["click"]);
  });
});
