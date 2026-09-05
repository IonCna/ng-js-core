import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerHostBindings } from "@/core/lifecycle/host-binding-bridge.ts";
import { Component, component } from "@/core/metadata/component.ts";
import { HostBinding } from "@/core/metadata/host-binding.ts";
import { hostBinding } from "@/core/metadata/markers.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

// biome-ignore lint: necesita calzar con IControllerConstructor de @types/angular
function bootWidget(Controller: new (...args: any[]) => object) {
  const name = uniqueName("hostBindingTest");
  angular.module(name, []).decorator("$controller", decorateControllerHostBindings).component("widget", {
    template: "ok",
    controller: Controller,
  });

  const host = document.createElement("div");
  host.innerHTML = "<widget></widget>";
  document.body.appendChild(host);

  const injector = angular.bootstrap(host, [name], { strictDi: false });
  const widgetEl = host.querySelector("widget") as HTMLElement;
  return { injector, widgetEl, $rootScope: injector.get<angular.IRootScopeService>("$rootScope") };
}

describe("etapa 5 — @HostBinding wiring contra el $element real", () => {
  it("class.X hace toggle de la clase CSS según la truthiness", () => {
    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostBinding("class.active") isActive = false;
    }

    const { widgetEl, $rootScope } = bootWidget(Widget);
    expect(widgetEl.classList.contains("active")).toBe(false);

    const ctrl = angular.element(widgetEl).controller("widget") as Widget;
    ctrl.isActive = true;
    $rootScope.$digest();

    expect(widgetEl.classList.contains("active")).toBe(true);
  });

  it("style.X pone el estilo inline", () => {
    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostBinding("style.color") color = "red";
    }

    const { widgetEl } = bootWidget(Widget);
    expect(widgetEl.style.color).toBe("red");
  });

  it("attr.X pone/quita el atributo", () => {
    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostBinding("attr.aria-label") label: string | null = "hola";
    }

    const { widgetEl, $rootScope } = bootWidget(Widget);
    expect(widgetEl.getAttribute("aria-label")).toBe("hola");

    const ctrl = angular.element(widgetEl).controller("widget") as Widget;
    ctrl.label = null;
    $rootScope.$digest();

    expect(widgetEl.hasAttribute("aria-label")).toBe(false);
  });

  it("un hostProperty plano pone la propiedad DOM directo", () => {
    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostBinding("id") elId = "my-id";
    }

    const { widgetEl } = bootWidget(Widget);
    expect(widgetEl.id).toBe("my-id");
  });

  it("JS puro (hostBinding(), sin decoradores) también se cablea", () => {
    class Widget {
      static hostBindings = { isActive: hostBinding("class.active") };
      isActive = true;
    }
    component(Widget).define({ selector: "widget" });

    const { widgetEl } = bootWidget(Widget);
    expect(widgetEl.classList.contains("active")).toBe(true);
  });

  it("el watch se desregistra en $destroy — no sigue reaccionando después", () => {
    @Component({ selector: "widget", template: "ok" })
    class Widget {
      @HostBinding("class.active") isActive = false;
    }

    const { widgetEl, $rootScope } = bootWidget(Widget);
    const ctrl = angular.element(widgetEl).controller("widget") as Widget;

    const scope = angular.element(widgetEl).scope() as angular.IScope;
    scope.$destroy();

    ctrl.isActive = true;
    expect(() => $rootScope.$digest()).not.toThrow();
    // el binding ya no se aplica: el watch fue desregistrado en $destroy
    expect(widgetEl.classList.contains("active")).toBe(false);
  });
});
