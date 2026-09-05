import angular from "angular";
import { describe, expect, it } from "vitest";
import { NgContainer } from "@/runtime/common/ng-container.ts";
import { decorateControllerViewContainerRef } from "@/runtime/bridges/view-container-ref-bridge.ts";
import { ViewRefImpl } from "@/core/refs/view-ref.ts";
import type { ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootNgContainer(html: string): { host: HTMLElement; captured: NgContainer[]; $rootScope: angular.IRootScopeService } {
  const captured: NgContainer[] = [];
  const name = uniqueName("ngContainerTest");
  angular
    .module(name, [])
    .decorator("$controller", decorateControllerViewContainerRef)
    .directive("ngContainer", NgContainer.$factory)
    .directive("captureNgContainer", () => ({
      require: "ngContainer",
      link: (_scope: angular.IScope, _el: unknown, _attrs: unknown, ctrl?: NgContainer) => {
        if (ctrl) captured.push(ctrl);
      },
    }));

  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [name], { strictDi: false });
  return { host, captured, $rootScope: injector.get<angular.IRootScopeService>("$rootScope") };
}

describe("etapa 8 — <ng-container> (sin huella en el DOM, ancla de ViewContainerRef)", () => {
  it("no renderiza su propio contenido: el <span> interno no queda en el DOM", () => {
    const { host } = bootNgContainer("<ng-container capture-ng-container><span>hola</span></ng-container>");

    expect(host.querySelector("span")).toBeNull();
  });

  it("expone un ViewContainerRef real, anclado a su propio lugar en el DOM", () => {
    const { host, captured } = bootNgContainer("<div><ng-container capture-ng-container></ng-container></div>");
    const [ngContainer] = captured;

    expect(ngContainer.viewContainerRef).toBeDefined();

    const node = document.createElement("span");
    node.textContent = "insertado";
    const view = new ViewRefImpl(angular.injector(["ng"]).get<angular.IRootScopeService>("$rootScope").$new(), [node]);

    (ngContainer.viewContainerRef as ViewContainerRefImpl).insert(view);

    expect(host.querySelector("span")?.textContent).toBe("insertado");
  });

  it("$onDestroy limpia (clear()) las vistas insertadas en su ViewContainerRef", () => {
    const { host, captured, $rootScope } = bootNgContainer("<div><ng-container capture-ng-container></ng-container></div>");
    const [ngContainer] = captured;

    const node = document.createElement("span");
    node.textContent = "insertado";
    const view = new ViewRefImpl(angular.injector(["ng"]).get<angular.IRootScopeService>("$rootScope").$new(), [node]);
    (ngContainer.viewContainerRef as ViewContainerRefImpl).insert(view);

    expect(host.querySelector("span")).not.toBeNull();

    $rootScope.$destroy();

    expect(host.querySelector("span")).toBeNull();
  });
});
