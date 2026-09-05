import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerViewChildQueries } from "@/runtime/bridges/ng-ref-bridge.ts";
import { QueryList } from "@/core/queries/query-list.ts";
import { ViewChildren, viewChildren } from "@/core/queries/view-children.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootTree(html: string, components: Record<string, angular.Injectable<angular.IControllerConstructor>>): { host: Element } {
  const name = uniqueName("viewChildrenTest");
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

function allControllersOf<T>(host: Element, selector: string): T[] {
  return Array.from(host.querySelectorAll(selector)).map((el) => angular.element(el).controller(selector) as T);
}

describe("etapa 7 — viewChildren()/@ViewChildren", () => {
  it("JS: viewChildren(Hijo) devuelve un array plano con todos los hijos que matchean", () => {
    class Child {}
    class Parent {
      hijos = viewChildren(Child);
    }

    const { host } = bootTree("<parent><child></child><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");
    const children = allControllersOf<Child>(host, "child");

    expect(parentCtrl.hijos).toEqual(children);
    expect(Array.isArray(parentCtrl.hijos)).toBe(true);
  });

  it("TS: @ViewChildren(Hijo) devuelve un QueryList vivo", () => {
    class Child {}
    class Parent {
      @ViewChildren(Child) hijos!: QueryList<Child>;
    }

    const { host } = bootTree("<parent><child></child><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");
    const children = allControllersOf<Child>(host, "child");

    expect(parentCtrl.hijos).toBeInstanceOf(QueryList);
    expect(parentCtrl.hijos.length).toBe(2);
    expect(parentCtrl.hijos.toArray()).toEqual(children);
  });

  it("sin hijos que matcheen, el array/QueryList queda vacío (no explota)", () => {
    class Child {}
    class Other {}
    class Parent {
      hijos = viewChildren(Other);
      @ViewChildren(Other) hijosQl!: QueryList<Other>;
    }

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");

    expect(parentCtrl.hijos).toEqual([]);
    expect(parentCtrl.hijosQl.length).toBe(0);
  });

  it("QueryList.changes no reproduce emisiones pasadas a un suscriptor tardío (Subject, no ReplaySubject)", () => {
    class Child {}
    class Parent {
      @ViewChildren(Child) hijos!: QueryList<Child>;
    }

    const { host } = bootTree("<parent><child></child><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");

    // $postLink (con su resolve()+notifyOnChanges()) ya corrió antes de esta
    // suscripción — el resultado en sí ya está en .toArray()/.length, pero
    // "changes" no reproduce esa emisión pasada.
    const emissions: number[] = [];
    parentCtrl.hijos.changes.subscribe((ql) => emissions.push(ql.length));

    expect(emissions).toEqual([]);
    expect(parentCtrl.hijos.length).toBe(2);
  });

  it("destroy(): al destruirse el $scope, el QueryList completa su Observable de changes", () => {
    class Child {}
    class Parent {
      @ViewChildren(Child) hijos!: QueryList<Child>;
    }

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const parentCtrl = controllerOf<Parent>(host, "parent");

    let completed = false;
    parentCtrl.hijos.changes.subscribe({ complete: () => (completed = true) });

    const scope = angular.element(host.querySelector("parent") as Element).scope() as angular.IScope;
    scope.$destroy();

    expect(completed).toBe(true);
  });
});
