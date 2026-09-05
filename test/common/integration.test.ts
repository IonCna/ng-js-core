import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { NgContainer } from "@/runtime/common/ng-container.ts";
import { NgContent } from "@/runtime/common/ng-content.ts";
import { NgTemplateOutlet } from "@/runtime/common/ng-template-outlet.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { decorateControllerAttributes } from "@/runtime/bridges/attribute-bridge.ts";
import { decorateControllerElementRef } from "@/runtime/bridges/element-ref-bridge.ts";
import { decorateControllerHostBindings } from "@/runtime/bridges/host-binding-bridge.ts";
import { decorateControllerHostListeners } from "@/runtime/bridges/host-listener-bridge.ts";
import { decorateControllerLifecycle } from "@/runtime/bridges/lifecycle-bridge.ts";
import { decorateControllerScopedInjector } from "@/runtime/bridges/scoped-injector-bridge.ts";
import { decorateControllerViewContainerRef } from "@/runtime/bridges/view-container-ref-bridge.ts";
import { Attribute } from "@/core/metadata/attribute.ts";
import { component } from "@/core/metadata/component.ts";
import { HostBinding } from "@/core/metadata/host-binding.ts";
import { HostListener } from "@/core/metadata/host-listener.ts";
import { Input } from "@/core/metadata/input.ts";
import { ContentChild } from "@/core/queries/content-child.ts";
import { decorateNgRefDirective, decorateControllerViewChildQueries } from "@/runtime/bridges/ng-ref-bridge.ts";
import { ViewChild } from "@/core/queries/view-child.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";
import { ViewContainerRef, ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

/**
 * Todos los bridges de etapas 5-8, en el orden real: scoped-injector primero
 * (augmentLocals corre al final), después element-ref/attribute (mismo
 * augmentLocals, claves distintas), después queries ANTES que lifecycle
 * (los dos encadenan $postLink — ver ng-ref-bridge.ts/shared.ts), el resto
 * sin orden que les importe (onInstance/locals propios, claves separadas).
 */
function registerAllBridges(module: angular.IModule): angular.IModule {
  return module
    .decorator("$controller", decorateControllerScopedInjector)
    .decorator("$controller", decorateControllerElementRef)
    .decorator("$controller", decorateControllerAttributes)
    .decorator("$controller", decorateControllerViewContainerRef)
    .decorator("$controller", decorateControllerViewChildQueries)
    .decorator("$controller", decorateControllerHostListeners)
    .decorator("$controller", decorateControllerHostBindings)
    .decorator("$controller", decorateControllerLifecycle)
    .decorator("ngRefDirective", decorateNgRefDirective)
    .directive("ngContent", NgContent.$factory)
    .directive("ngContainer", NgContainer.$factory)
    .directive("ngTemplate", TemplateRef.$factory)
    .directive("ngTemplateOutlet", NgTemplateOutlet.$factory);
}

function controllerOf<T>(host: Element, selector: string): T {
  return angular.element(host.querySelector(selector) as Element).controller(selector) as T;
}

describe("etapa 8 — integración: proyección/queries/ng-ref mezclados con todo lo demás", () => {
  it("padre con DI jerárquico + ElementRef + HostBinding + lifecycle + @ViewChild, hijo con @ContentChild sobre un nieto con providers/@Attribute/@HostListener propios", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
      greet(): string {
        return "hola";
      }
    }

    @Injectable()
    class Grandchild {
      clicked = false;
      constructor(
        public elementRef: ElementRef,
        @Attribute("type") public type: string,
      ) {}

      @HostListener("click")
      onClick(): void {
        this.clicked = true;
      }
    }
    component(Grandchild).define({ selector: "grandchild", providers: [Greeter] });

    @Injectable()
    class Child {
      @ContentChild(Grandchild) proyectado?: Grandchild;
    }
    component(Child).define({ selector: "child" });

    @Injectable()
    class Parent {
      @ViewChild(Child) hijo?: Child;
      @HostBinding("class.ready") ready = false;
      initCalls = 0;
      sawChildAtAfterViewInit: unknown;

      constructor(public elementRef: ElementRef) {}

      ngOnInit(): void {
        this.initCalls++;
      }
      ngAfterViewInit(): void {
        this.sawChildAtAfterViewInit = this.hijo;
      }
    }
    component(Parent).define({ selector: "parent" });

    const name = uniqueName("commonIntegrationAll");
    const module = registerAllBridges(angular.module(name, []));
    module.component("parent", { template: "<ng-transclude></ng-transclude>", transclude: true, controller: Parent });
    module.component("child", { template: "<ng-content></ng-content>", transclude: true, controller: Child });
    module.component("grandchild", { template: "ok", controller: Grandchild });

    const host = document.createElement("div");
    host.innerHTML = '<parent><child><grandchild type="checkbox"></grandchild></child></parent>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const parentEl = host.querySelector("parent") as HTMLElement;
    const grandchildEl = host.querySelector("grandchild") as HTMLElement;
    const parentCtrl = controllerOf<Parent>(host, "parent");
    const childCtrl = controllerOf<Child>(host, "child");
    const grandchildCtrl = controllerOf<Grandchild>(host, "grandchild");

    // DI jerárquico + ElementRef del propio Grandchild, con providers propios
    expect(grandchildCtrl.elementRef.nativeElement).toBe(grandchildEl);
    expect(grandchildCtrl.type).toBe("checkbox");

    // @ContentChild: Child ve al Grandchild PROYECTADO dentro suyo
    expect(childCtrl.proyectado).toBe(grandchildCtrl);

    // @ViewChild: Parent ve al Child (vista propia, no proyectado)
    expect(parentCtrl.hijo).toBe(childCtrl);
    expect(parentCtrl.sawChildAtAfterViewInit).toBe(childCtrl);
    expect(parentCtrl.initCalls).toBe(1);

    // ElementRef del propio Parent
    expect(parentCtrl.elementRef.nativeElement).toBe(parentEl);

    // @HostListener del nieto sigue andando
    grandchildEl.dispatchEvent(new MouseEvent("click"));
    expect(grandchildCtrl.clicked).toBe(true);

    // @HostBinding del padre sigue andando
    parentCtrl.ready = true;
    $rootScope.$digest();
    expect(parentEl.classList.contains("ready")).toBe(true);
  });

  it("ViewContainerRef.createComponent + createEmbeddedView insertan juntos, en el orden pedido", async () => {
    class Card {
      @Input() label = "";
    }
    component(Card).define({ selector: "dyn-card" });

    const name = uniqueName("commonIntegrationVcr");
    const module = registerAllBridges(angular.module(name, []));
    module.component("dynCard", { template: "{{ $ctrl.label }}", bindings: { label: "<" }, controller: Card });
    module.component("host", {
      template: '<ng-template ng-ref="tpl" ng-ref-read="ngTemplate" let-item="$implicit"><span>{{item}}</span></ng-template>',
      controller: class {
        static $inject = [ViewContainerRef.$name];
        vcr: ViewContainerRef;
        constructor(vcr: ViewContainerRef) {
          this.vcr = vcr;
        }
      },
    });

    const host = document.createElement("div");
    host.innerHTML = "<host></host>";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const hostCtrl = controllerOf<{ vcr: ViewContainerRefImpl }>(host, "host");
    const hostEl = host.querySelector("host") as Element;
    const tpl = (angular.element(hostEl).isolateScope() as unknown as { tpl: TemplateRef }).tpl;

    hostCtrl.vcr.createEmbeddedView(tpl, { $implicit: "embebido" });
    await hostCtrl.vcr.createComponent(Card, { bindings: { label: "componente" } });
    $rootScope.$digest();

    const spans = Array.from(hostEl.parentElement?.querySelectorAll("span") ?? []);
    expect(spans.map((el) => el.textContent)).toEqual(["embebido"]);
    expect(hostEl.parentElement?.querySelector("dyn-card")?.textContent).toBe("componente");
    expect(hostCtrl.vcr.length).toBe(2);
  });

  it("<ng-container> como ancla: insertar un componente dinámico vía su ViewContainerRef, y limpiarlo al destruir el scope", async () => {
    class Card {}
    component(Card).define({ selector: "dyn-card2" });

    const name = uniqueName("commonIntegrationContainer");
    const captured: NgContainer[] = [];
    const module = registerAllBridges(angular.module(name, []));
    module
      .component("dynCard2", { template: "ok", controller: Card })
      .directive("captureNgContainer", () => ({
        require: "ngContainer",
        link: (_scope: angular.IScope, _el: unknown, _attrs: unknown, ctrl?: NgContainer) => {
          if (ctrl) captured.push(ctrl);
        },
      }));

    const host = document.createElement("div");
    host.innerHTML = "<div><ng-container capture-ng-container></ng-container></div>";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const [ngContainer] = captured;
    await (ngContainer.viewContainerRef as ViewContainerRefImpl).createComponent(Card);
    $rootScope.$digest();

    expect(host.querySelector("dyn-card2")).not.toBeNull();

    $rootScope.$destroy();
    expect(host.querySelector("dyn-card2")).toBeNull();
  });

  it('viewChild("nombre") resuelve un TemplateRef publicado por ng-ref, y ese TemplateRef alimenta un *ngTemplateOutlet', () => {
    class Widget {
      @ViewChild("tpl") tpl?: TemplateRef;
    }
    component(Widget).define({ selector: "widget" });

    const name = uniqueName("commonIntegrationOutlet");
    const module = registerAllBridges(angular.module(name, []));
    module.component("widget", {
      template:
        '<ng-template ng-ref="tpl" let-item="$implicit"><span>{{item}}</span></ng-template>' +
        '<div ng-template-outlet="$ctrl.tpl" ng-template-outlet-context="{$implicit: \'via-query\'}"></div>',
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    const widgetCtrl = controllerOf<Widget>(host, "widget");
    expect(widgetCtrl.tpl).toBeInstanceOf(TemplateRef);
    expect(host.querySelector("widget span")?.textContent).toBe("via-query");
  });
});
