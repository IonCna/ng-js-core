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
import { Input } from "@/core/metadata/input.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

/**
 * Registra los 6 bridges de etapa 5 en el orden real: `scoped-injector`
 * primero (registrado primero => envuelve más adentro => su `augmentLocals`
 * corre AL FINAL, viendo ya puestas las claves que agregaron los demás — ver
 * `scoped-injector-bridge.ts`). El resto va en cualquier orden entre sí:
 * `element-ref`/`attribute` no comparten claves de `locals`, y
 * `host-listener`/`host-binding`/`lifecycle` solo usan `onInstance`.
 */
function registerAllBridges(module: angular.IModule): angular.IModule {
  return module
    .decorator("$controller", decorateControllerScopedInjector)
    .decorator("$controller", decorateControllerElementRef)
    .decorator("$controller", decorateControllerAttributes)
    .decorator("$controller", decorateControllerHostListeners)
    .decorator("$controller", decorateControllerHostBindings)
    .decorator("$controller", decorateControllerLifecycle);
}

describe("etapa 5 — integración: todas las piezas mezcladas en el mismo componente", () => {
  it("providers + ElementRef + @Attribute + @HostListener + @HostBinding + lifecycle, todo junto, en un solo controller", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
      greet(): string {
        return "hola";
      }
    }

    @Injectable()
    class Widget {
      @Input() label = "";
      @HostBinding("class.active") isActive = false;

      initCalls = 0;
      changesSeen: unknown[] = [];
      doCheckCalls = 0;
      destroyed = false;
      clicked = false;

      constructor(
        public greeter: Greeter,
        public elementRef: ElementRef,
        @Attribute("type") public type: string,
      ) {}

      ngOnInit(): void {
        this.initCalls++;
      }
      ngOnChanges(changes: unknown): void {
        this.changesSeen.push(changes);
      }
      ngDoCheck(): void {
        this.doCheckCalls++;
      }
      ngOnDestroy(): void {
        this.destroyed = true;
      }

      @HostListener("click")
      onClick(): void {
        this.clicked = true;
      }
    }
    component(Widget).define({ selector: "widget", providers: [Greeter] });

    const name = uniqueName("integrationAll");
    registerAllBridges(angular.module(name, [])).component("widget", {
      template: "ok",
      bindings: { label: "<" },
      controller: Widget,
    });

    const host = document.createElement("div");
    host.innerHTML = '<widget type="checkbox" label="hi"></widget>';
    document.body.appendChild(host);

    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    $rootScope.$digest();

    const widgetEl = host.querySelector("widget") as HTMLElement;
    const ctrl = angular.element(widgetEl).controller("widget") as Widget;

    // DI jerárquico: instancia real de Greeter, vía providers propios del nodo
    expect(ctrl.greeter).toBeInstanceOf(Greeter);
    expect(ctrl.greeter.greet()).toBe("hola");

    // ElementRef: apunta al $element real, no al que armó el inyector
    expect(ctrl.elementRef.nativeElement).toBe(widgetEl);

    // @Attribute: valor literal del atributo HTML
    expect(ctrl.type).toBe("checkbox");

    // lifecycle: ngOnInit corrió, ngOnChanges vio al menos un cambio, ngDoCheck corrió
    expect(ctrl.initCalls).toBe(1);
    expect(ctrl.changesSeen.length).toBeGreaterThan(0);
    expect(ctrl.doCheckCalls).toBeGreaterThanOrEqual(1);

    // @HostListener: click nativo dispara el método
    widgetEl.dispatchEvent(new MouseEvent("click"));
    expect(ctrl.clicked).toBe(true);

    // @HostBinding: cambiar la propiedad refleja la clase CSS
    ctrl.isActive = true;
    $rootScope.$digest();
    expect(widgetEl.classList.contains("active")).toBe(true);

    // ngOnDestroy corre al destruir el scope
    const scope = angular.element(widgetEl).scope() as angular.IScope;
    scope.$destroy();
    expect(ctrl.destroyed).toBe(true);
  });

  it("un hijo sin providers propios resuelve DI-jerárquico + ElementRef + @Attribute a la vez, sin que un bridge pise al otro", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
    }

    @Injectable()
    class Parent {}
    component(Parent).define({ selector: "parent", providers: [Greeter] });

    @Injectable()
    class Child {
      constructor(
        public greeter: Greeter,
        public elementRef: ElementRef,
        @Attribute("type") public type: string,
      ) {}
    }
    component(Child).define({ selector: "child" });

    const name = uniqueName("integrationChild");
    const module = registerAllBridges(angular.module(name, []));
    module.component("parent", { template: "<ng-transclude></ng-transclude>", transclude: true, controller: Parent });
    module.component("child", { template: "ok", controller: Child });

    const host = document.createElement("div");
    host.innerHTML = '<parent><child type="radio"></child></parent>';
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const childEl = host.querySelector("child") as HTMLElement;
    const childCtrl = angular.element(childEl).controller("child") as Child;

    expect(childCtrl.greeter).toBeInstanceOf(Greeter);
    expect(childCtrl.elementRef.nativeElement).toBe(childEl);
    expect(childCtrl.type).toBe("radio");
  });

  it("ngOnDestroy del controller y el teardown del nodo del inyector corren juntos al destruir el scope, sin pisarse", () => {
    let providerDestroyed = false;
    let controllerDestroyed = false;

    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
      ngOnDestroy(): void {
        providerDestroyed = true;
      }
    }

    @Injectable()
    class Widget {
      constructor(public greeter: Greeter) {}
      ngOnDestroy(): void {
        controllerDestroyed = true;
      }
    }
    component(Widget).define({ selector: "widget", providers: [Greeter] });

    const name = uniqueName("integrationTeardown");
    registerAllBridges(angular.module(name, [])).component("widget", { template: "ok", controller: Widget });

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);
    angular.bootstrap(host, [name], { strictDi: false });

    const scope = angular.element(host.querySelector("widget") as Element).scope() as angular.IScope;
    scope.$destroy();

    expect(providerDestroyed).toBe(true);
    expect(controllerDestroyed).toBe(true);
  });

  it("orden incorrecto de decorators rompe la composición: si ElementRef corre antes que scoped-injector, este último no lo ve y explota", () => {
    @Injectable()
    class Marker {
      static readonly $name = "Marker";
    }

    @Injectable()
    class Widget {
      constructor(public elementRef: ElementRef) {}
    }
    component(Widget).define({ selector: "widget", providers: [Marker] });

    const name = uniqueName("integrationWrongOrder");
    const seenErrors: unknown[] = [];
    angular
      .module(name, [])
      // orden invertido a propósito: element-ref registrado PRIMERO corre su
      // augmentLocals AL FINAL; scoped-injector registrado DESPUÉS corre PRIMERO,
      // sin ver todavía la clave "ElementRef" en locals, e intenta resolverla
      // como si fuera un token de DI cualquiera.
      .decorator("$controller", decorateControllerElementRef)
      .decorator("$controller", decorateControllerScopedInjector)
      .component("widget", { template: "ok", controller: Widget })
      // AngularJS no deja escapar el error de $compile/linking hacia afuera de
      // angular.bootstrap() — lo atrapa y lo manda a $exceptionHandler. Lo
      // capturamos ahí en vez de esperar un throw síncrono.
      .decorator("$exceptionHandler", [
        "$delegate",
        ($delegate: (error: unknown) => void) =>
          (error: unknown) => {
            seenErrors.push(error);
            $delegate(error);
          },
      ]);

    const host = document.createElement("div");
    host.innerHTML = "<widget></widget>";
    document.body.appendChild(host);

    angular.bootstrap(host, [name], { strictDi: false });

    expect(seenErrors).toHaveLength(1);
    expect(String(seenErrors[0])).toMatch(/no se encontró un provider/);
  });
});
