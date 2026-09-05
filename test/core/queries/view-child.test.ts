import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerLifecycle } from "@/core/lifecycle/lifecycle-bridge.ts";
import { decorateControllerViewChildQueries } from "@/core/queries/ng-ref-bridge.ts";
import { ViewChild, viewChild } from "@/core/queries/view-child.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootTree(html: string, components: Record<string, angular.Injectable<angular.IControllerConstructor>>): { host: Element } {
  const name = uniqueName("viewChildTest");
  const module = angular.module(name, []).decorator("$controller", decorateControllerViewChildQueries);
  for (const [selector, controller] of Object.entries(components)) {
    module.component(selector, { template: "<ng-transclude></ng-transclude>", transclude: true, controller });
  }

  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  angular.bootstrap(host, [name], { strictDi: false });
  return { host };
}

function controllerOf<T>(host: Element, selector: string): T {
  return angular.element(host.querySelector(selector) as Element).controller(selector) as T;
}

describe("etapa 7 — viewChild()/@ViewChild (por clase, automático, resuelto en $postLink)", () => {
  it("JS: viewChild(Hijo) resuelve la instancia real del hijo", () => {
    class Child {}
    class Parent {
      hijo = viewChild(Child);
    }

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");
    const childCtrl = controllerOf<Child>(host, "child");

    expect(parentCtrl.hijo).toBe(childCtrl);
  });

  it("TS: @ViewChild(Hijo) resuelve igual", () => {
    class Child {}
    class Parent {
      @ViewChild(Child) hijo?: Child;
    }

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");
    const childCtrl = controllerOf<Child>(host, "child");

    expect(parentCtrl.hijo).toBe(childCtrl);
  });

  it("matchea también por una clase base (subclase del locator)", () => {
    class Base {}
    class Child extends Base {}
    class Parent {
      hijo = viewChild(Base);
    }

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");
    const childCtrl = controllerOf<Child>(host, "child");

    expect(parentCtrl.hijo).toBe(childCtrl);
  });

  it("sin hijo que matchee, la query queda undefined (no explota)", () => {
    class Child {}
    class Other {}
    class Parent {
      hijo = viewChild(Other);
    }

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");

    expect(parentCtrl.hijo).toBeUndefined();
  });

  it("dos instancias del mismo padre resuelven cada una su propio hijo, sin cruzarse", () => {
    class Child {
      static $inject: string[] = [];
    }
    class Parent {
      hijo = viewChild(Child);
    }

    const { host } = bootTree(
      "<parent><child></child></parent><parent><child></child></parent>",
      { parent: Parent, child: Child },
    );
    const [firstParentEl, secondParentEl] = Array.from(host.querySelectorAll("parent"));
    const firstParent = angular.element(firstParentEl).controller("parent") as Parent;
    const secondParent = angular.element(secondParentEl).controller("parent") as Parent;
    const firstChild = angular.element(firstParentEl.querySelector("child") as Element).controller("child") as Child;
    const secondChild = angular.element(secondParentEl.querySelector("child") as Element).controller("child") as Child;

    expect(firstParent.hijo).toBe(firstChild);
    expect(secondParent.hijo).toBe(secondChild);
    expect(firstParent.hijo).not.toBe(secondParent.hijo);
  });

  it("convive con lifecycle-bridge.ts en el mismo $postLink (ngAfterViewInit ve el viewChild ya resuelto)", () => {
    class Child {}
    let sawChildAtAfterViewInit: unknown;
    class Parent {
      hijo = viewChild(Child);
      ngAfterViewInit(): void {
        sawChildAtAfterViewInit = this.hijo;
      }
    }

    const name = uniqueName("viewChildLifecycleTest");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerViewChildQueries)
      .decorator("$controller", decorateControllerLifecycle)
      .component("parent", { template: "<ng-transclude></ng-transclude>", transclude: true, controller: Parent })
      .component("child", { template: "ok", controller: Child });

    const host = document.createElement("div");
    host.innerHTML = "<parent><child></child></parent>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const childCtrl = controllerOf<Child>(host, "child");
    expect(sawChildAtAfterViewInit).toBe(childCtrl);
  });
});
