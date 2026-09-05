import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { decorateControllerAttributes } from "@/runtime/bridges/attribute-bridge.ts";
import { decorateControllerElementRef } from "@/runtime/bridges/element-ref-bridge.ts";
import { decorateControllerHostBindings } from "@/runtime/bridges/host-binding-bridge.ts";
import { decorateControllerHostListeners } from "@/runtime/bridges/host-listener-bridge.ts";
import { decorateControllerLifecycle } from "@/runtime/bridges/lifecycle-bridge.ts";
import { decorateControllerScopedInjector } from "@/runtime/bridges/scoped-injector-bridge.ts";
import { Attribute } from "@/core/metadata/attribute.ts";
import { component } from "@/core/metadata/component.ts";
import { HostBinding } from "@/core/metadata/host-binding.ts";
import { HostListener } from "@/core/metadata/host-listener.ts";
import { decorateControllerViewChildQueries } from "@/runtime/bridges/ng-ref-bridge.ts";
import { QueryList } from "@/core/queries/query-list.ts";
import { ViewChild } from "@/core/queries/view-child.ts";
import { ViewChildren } from "@/core/queries/view-children.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

/**
 * Orden real: scoped-injector primero (solo usa augmentLocals, corre su
 * augmentLocals al final — ver scoped-injector-bridge.ts), después
 * element-ref/attribute (mismo augmentLocals, claves distintas), después
 * queries ANTES que lifecycle (los dos encadenan $postLink — para que
 * ngAfterViewInit vea las queries ya resueltas, queries tiene que
 * registrarse primero, ver la nota de shared.ts/chainInstanceMethod).
 * host-listener/host-binding solo usan onInstance, sin orden que les importe.
 */
function registerAllBridges(module: angular.IModule): angular.IModule {
  return module
    .decorator("$controller", decorateControllerScopedInjector)
    .decorator("$controller", decorateControllerElementRef)
    .decorator("$controller", decorateControllerAttributes)
    .decorator("$controller", decorateControllerViewChildQueries)
    .decorator("$controller", decorateControllerHostListeners)
    .decorator("$controller", decorateControllerHostBindings)
    .decorator("$controller", decorateControllerLifecycle);
}

describe("etapa 7 — integración: viewChild/viewChildren mezclados con todo lo demás", () => {
  it("un padre con providers + ElementRef + @HostBinding + lifecycle + viewChild/viewChildren de un hijo con su propio Attribute/ElementRef/HostListener", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
      greet(): string {
        return "hola";
      }
    }

    @Injectable()
    class Child {
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
    component(Child).define({ selector: "child" });

    @Injectable()
    class Parent {
      @ViewChild(Child) hijo?: Child;
      @ViewChildren(Child) hijos!: QueryList<Child>;
      @HostBinding("class.ready") ready = false;

      initCalls = 0;
      sawChildAtAfterViewInit: unknown;

      constructor(
        public greeter: Greeter,
        public elementRef: ElementRef,
      ) {}

      ngOnInit(): void {
        this.initCalls++;
      }
      ngAfterViewInit(): void {
        this.sawChildAtAfterViewInit = this.hijo;
      }
    }
    component(Parent).define({ selector: "parent", providers: [Greeter] });

    const name = uniqueName("queriesIntegrationAll");
    const module = registerAllBridges(angular.module(name, []));
    module.component("parent", { template: "<ng-transclude></ng-transclude>", transclude: true, controller: Parent });
    module.component("child", { template: "ok", controller: Child });

    const host = document.createElement("div");
    host.innerHTML = '<parent><child type="checkbox"></child></parent>';
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const parentEl = host.querySelector("parent") as HTMLElement;
    const childEl = host.querySelector("child") as HTMLElement;
    const parentCtrl = angular.element(parentEl).controller("parent") as Parent;
    const childCtrl = angular.element(childEl).controller("child") as Child;

    // DI jerárquico + ElementRef del padre, intactos
    expect(parentCtrl.greeter.greet()).toBe("hola");
    expect(parentCtrl.elementRef.nativeElement).toBe(parentEl);

    // viewChild/viewChildren resolvieron al hijo real
    expect(parentCtrl.hijo).toBe(childCtrl);
    expect(parentCtrl.hijos.toArray()).toEqual([childCtrl]);

    // lifecycle: ngOnInit corrió, y ngAfterViewInit ya vio el viewChild resuelto
    expect(parentCtrl.initCalls).toBe(1);
    expect(parentCtrl.sawChildAtAfterViewInit).toBe(childCtrl);

    // el hijo: ElementRef/@Attribute propios, sin que las queries del padre interfieran
    expect(childCtrl.elementRef.nativeElement).toBe(childEl);
    expect(childCtrl.type).toBe("checkbox");

    // @HostListener del hijo sigue andando
    childEl.dispatchEvent(new MouseEvent("click"));
    expect(childCtrl.clicked).toBe(true);

    // @HostBinding del padre sigue andando
    parentCtrl.ready = true;
    $rootScope.$digest();
    expect(parentEl.classList.contains("ready")).toBe(true);
  });

  it("orden de decorators invertido (lifecycle antes que queries): no explota, solo cambia si ngAfterViewInit ve la query ya resuelta", () => {
    class Child {}
    class Parent {
      @ViewChild(Child) hijo?: Child;
      sawChildAtAfterViewInit: unknown = "not-called";
      ngAfterViewInit(): void {
        this.sawChildAtAfterViewInit = this.hijo;
      }
    }
    component(Child).define({ selector: "child" });
    component(Parent).define({ selector: "parent" });

    const name = uniqueName("queriesWrongOrder");
    angular
      .module(name, [])
      .decorator("$controller", decorateControllerLifecycle) // registrado primero -> corre su $postLink al final
      .decorator("$controller", decorateControllerViewChildQueries) // registrado despues -> corre primero
      .component("parent", { template: "<ng-transclude></ng-transclude>", transclude: true, controller: Parent })
      .component("child", { template: "ok", controller: Child });

    const host = document.createElement("div");
    host.innerHTML = "<parent><child></child></parent>";
    document.body.appendChild(host);

    expect(() => angular.bootstrap(host, [name], { strictDi: false })).not.toThrow();

    const parentCtrl = angular.element(host.querySelector("parent") as Element).controller("parent") as Parent;
    const childCtrl = angular.element(host.querySelector("child") as Element).controller("child") as Child;

    // la query SÍ terminó resolviendo (ambos $postLink corrieron, nomás que en
    // el orden "al revés" del que arma la resolución del viewChild ANTES)
    expect(parentCtrl.hijo).toBe(childCtrl);
    // pero ngAfterViewInit corrió ANTES de que la query se resolviera (queries
    // quedó afuera/última en la cadena), así que en ese momento vio undefined
    expect(parentCtrl.sawChildAtAfterViewInit).toBeUndefined();
  });

  it("dos padres hermanos con viewChildren no se cruzan entre sí", () => {
    class Child {}
    class Parent {
      @ViewChildren(Child) hijos!: QueryList<Child>;
    }
    component(Child).define({ selector: "child" });
    component(Parent).define({ selector: "parent" });

    const name = uniqueName("queriesSiblingParents");
    const module = registerAllBridges(angular.module(name, []));
    module.component("parent", { template: "<ng-transclude></ng-transclude>", transclude: true, controller: Parent });
    module.component("child", { template: "ok", controller: Child });

    const host = document.createElement("div");
    host.innerHTML = "<parent><child></child></parent><parent><child></child><child></child></parent>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const [firstParentEl, secondParentEl] = Array.from(host.querySelectorAll("parent"));
    const firstParent = angular.element(firstParentEl).controller("parent") as Parent;
    const secondParent = angular.element(secondParentEl).controller("parent") as Parent;

    expect(firstParent.hijos.length).toBe(1);
    expect(secondParent.hijos.length).toBe(2);
  });
});
