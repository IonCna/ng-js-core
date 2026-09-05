import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Inject, Injectable } from "@/core/di/injectable.ts";
import { Optional, Self, SkipSelf } from "@/core/di/inject-flags.ts";
import { decorateControllerScopedInjector } from "@/core/lifecycle/scoped-injector-bridge.ts";
import { component } from "@/core/metadata/component.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

// biome-ignore lint: necesita calzar con IComponentOptions.controller de @types/angular
function bootTree(html: string, components: Record<string, new (...args: any[]) => object>) {
  const name = uniqueName("scopedInjectorTest");
  const module = angular.module(name, []).decorator("$controller", decorateControllerScopedInjector);
  for (const [selector, Controller] of Object.entries(components)) {
    module.component(selector, {
      template: "<ng-transclude></ng-transclude>",
      transclude: true,
      controller: Controller,
    });
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

describe("etapa 5 — inyector jerárquico ($controller wiring contra AngularJS real)", () => {
  it("un componente resuelve su ctor param contra su propio `providers`, sin pasar por $injector", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
      greet(): string {
        return "hola";
      }
    }

    @Injectable()
    class Widget {
      constructor(public greeter: Greeter) {}
    }
    component(Widget).define({ selector: "widget", providers: [Greeter] });

    const { host } = bootTree("<widget></widget>", { widget: Widget });
    const ctrl = controllerOf<Widget>(host, "widget");

    expect(ctrl.greeter).toBeInstanceOf(Greeter);
    expect(ctrl.greeter.greet()).toBe("hola");
  });

  it("dos instancias del mismo componente tienen cada una su propio nodo (no comparten la instancia del provider)", () => {
    @Injectable()
    class Counter {
      static readonly $name = "Counter";
      value = 0;
    }

    @Injectable()
    class Widget {
      constructor(public counter: Counter) {}
    }
    component(Widget).define({ selector: "widget", providers: [Counter] });

    const { host } = bootTree("<widget></widget><widget></widget>", { widget: Widget });
    const [first, second] = Array.from(host.querySelectorAll("widget"));
    const ctrl1 = angular.element(first).controller("widget") as Widget;
    const ctrl2 = angular.element(second).controller("widget") as Widget;

    expect(ctrl1.counter).not.toBe(ctrl2.counter);
  });

  it("un hijo sin providers propios hereda el nodo del padre", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
    }

    @Injectable()
    class Parent {}
    component(Parent).define({ selector: "parent", providers: [Greeter] });

    @Injectable()
    class Child {
      constructor(public greeter: Greeter) {}
    }
    component(Child).define({ selector: "child" });

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });

    const parentGreeter = controllerOf<Parent & { greeter?: Greeter }>(host, "parent");
    const childCtrl = controllerOf<Child>(host, "child");
    const parentNode = angular.element(host.querySelector("parent") as Element).data("$ngjsInjector") as {
      get: (t: unknown) => unknown;
    };

    expect(childCtrl.greeter).toBe(parentNode.get(Greeter));
    void parentGreeter;
  });

  it("@SkipSelf salta el provider propio del nodo y usa el del padre", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
    }

    @Injectable()
    class Parent {}
    component(Parent).define({ selector: "parent", providers: [{ provide: Greeter, useValue: "parent-greeter" }] });

    @Injectable()
    class Child {
      constructor(@SkipSelf() public greeter: Greeter) {}
    }
    component(Child).define({
      selector: "child",
      providers: [{ provide: Greeter, useValue: "child-greeter" }],
    });

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const childCtrl = controllerOf<Child>(host, "child");

    expect(childCtrl.greeter).toBe("parent-greeter");
  });

  it("sin @SkipSelf, el provider propio del nodo gana sobre el del padre", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
    }

    @Injectable()
    class Parent {}
    component(Parent).define({ selector: "parent", providers: [{ provide: Greeter, useValue: "parent-greeter" }] });

    @Injectable()
    class Child {
      constructor(public greeter: Greeter) {}
    }
    component(Child).define({
      selector: "child",
      providers: [{ provide: Greeter, useValue: "child-greeter" }],
    });

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const childCtrl = controllerOf<Child>(host, "child");

    expect(childCtrl.greeter).toBe("child-greeter");
  });

  it("@Self no sube al padre: si no está en el propio nodo, @Optional devuelve null", () => {
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
    }
    @Injectable()
    class Unrelated {
      static readonly $name = "Unrelated";
    }

    @Injectable()
    class Parent {}
    component(Parent).define({ selector: "parent", providers: [{ provide: Greeter, useValue: "parent-greeter" }] });

    @Injectable()
    class Child {
      constructor(
        @Self()
        @Optional()
        @Inject(Greeter)
        public greeter: Greeter | null,
      ) {}
    }
    component(Child).define({ selector: "child", providers: [Unrelated] });

    const { host } = bootTree("<parent><child></child></parent>", { parent: Parent, child: Child });
    const childCtrl = controllerOf<Child>(host, "child");

    expect(childCtrl.greeter).toBeNull();
  });

  it("@Optional devuelve null cuando el token no existe en ningún nodo ni en el $injector de la app", () => {
    class Missing {
      static readonly $name = "Missing";
    }
    @Injectable()
    class Present {
      static readonly $name = "Present";
    }

    @Injectable()
    class Widget {
      constructor(
        @Optional()
        @Inject(Missing)
        public missing: Missing | null,
      ) {}
    }
    // necesita providers propios para que exista un nodo — sin nodo en ningún nivel,
    // el bridge no interviene y el flag no aplica (ver scoped-injector-bridge.ts)
    component(Widget).define({ selector: "widget", providers: [Present] });

    const { host } = bootTree("<widget></widget>", { widget: Widget });
    const ctrl = controllerOf<Widget>(host, "widget");

    expect(ctrl.missing).toBeNull();
  });

  it("teardown: al destruir el $scope se llama ngOnDestroy de las instancias cacheadas en el nodo", () => {
    let destroyed = false;
    @Injectable()
    class Greeter {
      static readonly $name = "Greeter";
      ngOnDestroy(): void {
        destroyed = true;
      }
    }

    @Injectable()
    class Widget {
      constructor(public greeter: Greeter) {}
    }
    component(Widget).define({ selector: "widget", providers: [Greeter] });

    const { host } = bootTree("<widget></widget>", { widget: Widget });
    const widgetEl = host.querySelector("widget") as Element;
    const scope = angular.element(widgetEl).scope() as angular.IScope;

    scope.$destroy();
    expect(destroyed).toBe(true);
  });
});
