import angular from "angular";
import { describe, expect, it } from "vitest";
import { decorateControllerViewContainerRef } from "@/core/lifecycle/view-container-ref-bridge.ts";
import { decorateNgRefDirective, decorateControllerViewChildQueries } from "@/core/queries/ng-ref-bridge.ts";
import { ViewChild, viewChild } from "@/core/queries/view-child.ts";
import { ElementRef, ElementRefImpl } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function baseModule(name: string): angular.IModule {
  return angular
    .module(name, [])
    .decorator("$controller", decorateControllerViewChildQueries)
    .decorator("ngRefDirective", decorateNgRefDirective);
}

describe("etapa 8 — ng-ref (locator por string + read), decorando la directiva ngRef nativa", () => {
  it("sin ng-ref-read: asigna el ElementRef del elemento a la expresión del scope", () => {
    const name = uniqueName("ngRefTest");
    baseModule(name);

    const host = document.createElement("div");
    host.innerHTML = '<div ng-ref="captured"></div>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const captured = ($rootScope as unknown as { captured: ElementRefImpl }).captured;
    expect(captured).toBeInstanceOf(ElementRefImpl);
    expect(captured.nativeElement).toBe(host.querySelector("div"));
  });

  it('ng-ref-read="$element" da lo mismo que el default', () => {
    const name = uniqueName("ngRefTest");
    baseModule(name);

    const host = document.createElement("div");
    host.innerHTML = '<div ng-ref="captured" ng-ref-read="$element"></div>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const captured = ($rootScope as unknown as { captured: ElementRefImpl }).captured;
    expect(captured.nativeElement).toBe(host.querySelector("div"));
  });

  it('ng-ref-read="ngTemplate" resuelve el TemplateRef real, sobre un <ng-template> (transclude:"element")', () => {
    const name = uniqueName("ngRefTest");
    baseModule(name).directive("ngTemplate", TemplateRef.$factory);

    const host = document.createElement("div");
    host.innerHTML = '<ng-template ng-ref="captured" ng-ref-read="ngTemplate"><span>hola</span></ng-template>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const captured = ($rootScope as unknown as { captured: TemplateRef }).captured;
    expect(captured).toBeInstanceOf(TemplateRef);

    const view = captured.createEmbeddedView({});
    expect(view.rootNodes.map((node) => node.textContent).join("")).toContain("hola");
  });

  it('ng-ref-read="viewContainerRef" resuelve el ViewContainerRef del elemento, sin necesitar un directive aparte', () => {
    const name = uniqueName("ngRefTest");
    baseModule(name)
      .decorator("$controller", decorateControllerViewContainerRef)
      .component("widget", { template: "ok", controller: class {} });

    const host = document.createElement("div");
    host.innerHTML = '<widget ng-ref="captured" ng-ref-read="viewContainerRef"></widget>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const captured = ($rootScope as unknown as { captured: ViewContainerRefImpl }).captured;
    expect(captured).toBeInstanceOf(ViewContainerRefImpl);
    expect(captured.element.nativeElement).toBe(host.querySelector("widget"));
  });

  it("$destroy limpia la expresión del scope (solo si no cambió mientras tanto)", () => {
    const name = uniqueName("ngRefTest");
    // scope:true crea un scope propio para el div, así podemos destruirlo
    // directo sin arrastrar al $rootScope de todo el test.
    baseModule(name).directive("scopeBoundary", () => ({ scope: true }));

    const host = document.createElement("div");
    host.innerHTML = '<div scope-boundary ng-ref="captured"></div>';
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const divEl = host.querySelector("div") as Element;
    const divScope = angular.element(divEl).scope() as angular.IScope & { captured?: ElementRefImpl | null };

    expect(divScope.captured).toBeInstanceOf(ElementRefImpl);

    divScope.$destroy();

    expect(divScope.captured).toBeNull();
  });

  it('JS: viewChild("nombre") resuelve un ng-ref del PROPIO template del componente (no contenido externo)', () => {
    class Widget {
      capturado = viewChild<ElementRef>("myThing");
    }

    const name = uniqueName("ngRefTest");
    baseModule(name).component("widget", { template: '<div ng-ref="myThing"></div>', controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const widgetCtrl = angular.element(host.querySelector("widget") as Element).controller("widget") as Widget;
    expect(widgetCtrl.capturado).toBeInstanceOf(ElementRefImpl);
    expect((widgetCtrl.capturado as unknown as ElementRefImpl).nativeElement).toBe(host.querySelector("widget div"));
  });

  it('TS: @ViewChild("nombre") resuelve igual', () => {
    class Widget {
      @ViewChild("myThing") capturado?: ElementRef;
    }

    const name = uniqueName("ngRefTest");
    baseModule(name).component("widget", { template: '<div ng-ref="myThing"></div>', controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const widgetCtrl = angular.element(host.querySelector("widget") as Element).controller("widget") as Widget;
    expect(widgetCtrl.capturado).toBeInstanceOf(ElementRefImpl);
  });

  it('un locator string distinto no matchea (viewChild("otroNombre") queda undefined)', () => {
    class Widget {
      @ViewChild("otroNombre") capturado?: ElementRef;
    }

    const name = uniqueName("ngRefTest");
    baseModule(name).component("widget", { template: '<div ng-ref="myThing"></div>', controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const widgetCtrl = angular.element(host.querySelector("widget") as Element).controller("widget") as Widget;
    expect(widgetCtrl.capturado).toBeUndefined();
  });
});
