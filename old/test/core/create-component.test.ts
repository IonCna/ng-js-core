import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { createComponent } from "@/runtime/create-component.ts";
import { decorateControllerLifecycle } from "@/runtime/bridges/lifecycle-bridge.ts";
import { component } from "@/core/metadata/component.ts";
import { Input } from "@/core/metadata/input.ts";
import { PlatformRefImpl } from "@/core/platform/bootstrap.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function mountHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

describe("etapa 6 — createComponent / ComponentRef, ya registrado en Angular", () => {
  it("crea una instancia dinámica: instance/location/hostView/setInput/$onChanges/destroy", async () => {
    class Widget {
      @Input() title = "";
      changes: unknown[] = [];
      ngOnChanges(changes: unknown): void {
        this.changes.push(changes);
      }
    }
    component(Widget).define({ selector: "dyn-widget" });

    const name = uniqueName("createComponentTest");
    angular.module(name, []).decorator("$controller", decorateControllerLifecycle).component("dynWidget", {
      template: "{{ $ctrl.title }}",
      bindings: { title: "<" },
      controller: Widget,
    });

    const host = mountHost();
    const injector = angular.bootstrap(host, [name], { strictDi: false });

    const mount = mountHost();
    const componentRef = await createComponent<Widget>(Widget, {
      injector,
      hostElement: mount,
      bindings: { title: "hola" },
    });

    expect(componentRef.instance.title).toBe("hola");
    expect(componentRef.location.nativeElement.tagName.toLowerCase()).toBe("dyn-widget");
    expect(mount.contains(componentRef.location.nativeElement)).toBe(true);
    expect(componentRef.hostView.destroyed).toBe(false);

    // hostView arranca detached (igual que Angular real: no participa del CD
    // hasta que alguien lo adjunta — normalmente al insertarlo en un
    // ViewContainerRef, que ya llama reattach() solo; acá lo hacemos a mano).
    componentRef.hostView.reattach();
    injector.get<angular.IRootScopeService>("$rootScope").$digest();
    expect(componentRef.location.nativeElement.textContent).toContain("hola");

    componentRef.setInput("title", "actualizado");
    expect(componentRef.instance.title).toBe("actualizado");
    // AngularJS ya disparó un $onChanges "inicial" propio durante el $digest
    // recién hecho (mismo comportamiento documentado en lifecycle-bridge.test.ts)
    // — solo nos importa que setInput agregó el último, con el valor correcto.
    const lastChange = componentRef.instance.changes.at(-1) as {
      title: { currentValue: string; previousValue: string; isFirstChange(): boolean };
    };
    expect(lastChange.title.currentValue).toBe("actualizado");
    expect(lastChange.title.isFirstChange()).toBe(false);

    let destroyedCallback = false;
    componentRef.onDestroy(() => {
      destroyedCallback = true;
    });
    componentRef.destroy();

    expect(destroyedCallback).toBe(true);
    expect(componentRef.hostView.destroyed).toBe(true);
    expect(mount.contains(componentRef.location.nativeElement)).toBe(false);
    expect(() => componentRef.setInput("title", "tarde")).toThrow(/destruido/);
  });

  it("projectableNodes se proyectan dentro del host creado", async () => {
    class Card {}
    component(Card).define({ selector: "dyn-card" });

    const name = uniqueName("createComponentProjection");
    angular.module(name, []).component("dynCard", {
      template: '<div class="slot"><ngjs-projectable-node data-ngjs-projectable-node="0"></ngjs-projectable-node></div>',
      controller: Card,
    });

    const host = mountHost();
    const injector = angular.bootstrap(host, [name], { strictDi: false });

    const projected = document.createElement("b");
    projected.textContent = "proyectado";

    const mount = mountHost();
    const componentRef = await createComponent<Card>(Card, {
      injector,
      hostElement: mount,
      projectableNodes: [[projected]],
    });

    expect(componentRef.location.nativeElement.querySelector("b")?.textContent).toBe("proyectado");
  });

  it("directives agrega los atributos correspondientes al host", async () => {
    class Plain {}
    component(Plain).define({ selector: "dyn-plain" });

    const name = uniqueName("createComponentDirectives");
    const seenAttr: string[] = [];
    angular
      .module(name, [])
      .directive("focusTrap", () => ({
        link: (_scope: angular.IScope, el: angular.IAugmentedJQuery) => {
          seenAttr.push((el[0] as Element).getAttribute("focus-trap") ?? "");
        },
      }))
      .component("dynPlain", { template: "ok", controller: Plain });

    const host = mountHost();
    const injector = angular.bootstrap(host, [name], { strictDi: false });

    await createComponent<Plain>(Plain, {
      injector,
      hostElement: mountHost(),
      directives: ["focusTrap"],
    });

    expect(seenAttr).toEqual([""]);
  });
});

describe("etapa 6 — createComponent, componente NO registrado (chunk lazy real)", () => {
  it("lo registra solo vía ConfigProviderFactory.current, derivando bindings de @Input/@Output", async () => {
    const host = mountHost();
    const name = uniqueName("createComponentLazy");
    angular.module(name, []);

    const platform = new PlatformRefImpl();
    await platform.bootstrapModule(name, { hostElement: host });

    class LazyWidget {
      @Input() label = "";
    }
    component(LazyWidget).define({ selector: "lazy-dyn-widget" });

    const $injector = angular.element(host).injector();
    expect($injector.has("lazyDynWidgetDirective")).toBe(false);

    const componentRef = await createComponent<LazyWidget>(LazyWidget, {
      injector: $injector,
      hostElement: mountHost(),
      bindings: { label: "chunk" },
    });

    expect($injector.has("lazyDynWidgetDirective")).toBe(true);
    expect(componentRef.instance.label).toBe("chunk");

    platform.destroy();
  });

  it("createComponent de un @Component cargado con import() (dynamic import real)", async () => {
    const host = mountHost();
    const name = uniqueName("createComponentDynamicImport");
    angular.module(name, []);

    const platform = new PlatformRefImpl();
    await platform.bootstrapModule(name, { hostElement: host });

    const mod = await import("./fixtures/lazy-imported.component.ts");
    const $injector = angular.element(host).injector();

    const componentRef = await createComponent<InstanceType<typeof mod.LazyImportedComponent>>(mod.LazyImportedComponent, {
      injector: $injector,
      hostElement: mountHost(),
      bindings: { greeting: "importado" },
    });

    expect(componentRef.instance.greeting).toBe("importado");

    platform.destroy();
  });
});
