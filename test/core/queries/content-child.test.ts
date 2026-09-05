import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { NgContent } from "@/runtime/common/ng-content.ts";
import { decorateControllerViewChildQueries } from "@/runtime/bridges/ng-ref-bridge.ts";
import { ContentChild, contentChild } from "@/core/queries/content-child.ts";
import { ContentChildren } from "@/core/queries/content-children.ts";
import { QueryList } from "@/core/queries/query-list.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootProjection(
  hostHtml: string,
  components: Record<string, angular.Injectable<angular.IControllerConstructor>>,
  containerSelector = "child",
): { host: Element } {
  const name = uniqueName("contentChildTest");
  const module = angular.module(name, []).decorator("$controller", decorateControllerViewChildQueries).directive("ngContent", NgContent.$factory);

  for (const [selector, controller] of Object.entries(components)) {
    if (selector === containerSelector) {
      module.component(selector, { template: "<ng-content></ng-content>", transclude: true, controller });
    } else {
      module.component(selector, { template: "ok", controller });
    }
  }

  const host = document.createElement("div");
  host.innerHTML = hostHtml;
  document.body.appendChild(host);
  angular.bootstrap(host, [name], { strictDi: false });
  return { host };
}

function controllerOf<T>(host: Element, selector: string): T {
  return angular.element(host.querySelector(selector) as Element).controller(selector) as T;
}

describe("etapa 8 — @ContentChild/@ContentChildren + <ng-content> (proyección real)", () => {
  it("JS: contentChild(Nieto) resuelve el contenido proyectado, no un descendiente cualquiera del propio template", () => {
    class Grandchild {}
    class Child {
      proyectado = contentChild(Grandchild);
    }

    const { host } = bootProjection("<child><grandchild></grandchild></child>", { child: Child, grandchild: Grandchild });
    const childCtrl = controllerOf<Child>(host, "child");
    const grandchildCtrl = controllerOf<Grandchild>(host, "grandchild");

    expect(childCtrl.proyectado).toBe(grandchildCtrl);
  });

  it("TS: @ContentChild(Nieto) resuelve igual", () => {
    class Grandchild {}
    class Child {
      @ContentChild(Grandchild) proyectado?: Grandchild;
    }

    const { host } = bootProjection("<child><grandchild></grandchild></child>", { child: Child, grandchild: Grandchild });
    const childCtrl = controllerOf<Child>(host, "child");
    const grandchildCtrl = controllerOf<Grandchild>(host, "grandchild");

    expect(childCtrl.proyectado).toBe(grandchildCtrl);
  });

  it("@ContentChildren junta TODOS los proyectados en un QueryList", () => {
    class Grandchild {}
    class Child {
      @ContentChildren(Grandchild) proyectados!: QueryList<Grandchild>;
    }

    const { host } = bootProjection("<child><grandchild></grandchild><grandchild></grandchild></child>", {
      child: Child,
      grandchild: Grandchild,
    });
    const childCtrl = controllerOf<Child>(host, "child");
    const grandchildren = Array.from(host.querySelectorAll("grandchild")).map(
      (el) => angular.element(el).controller("grandchild") as Grandchild,
    );

    expect(childCtrl.proyectados.toArray()).toEqual(grandchildren);
  });

  it("un descendiente del PROPIO template de Child (no proyectado) no cuenta como contentChild", () => {
    class Grandchild {}
    class Child {
      @ContentChild(Grandchild) proyectado?: Grandchild;
    }

    // sin nada proyectado dentro de <child></child> — el <ng-content> queda vacío
    const { host } = bootProjection("<child></child>", { child: Child, grandchild: Grandchild });
    const childCtrl = controllerOf<Child>(host, "child");

    expect(childCtrl.proyectado).toBeUndefined();
  });
});
