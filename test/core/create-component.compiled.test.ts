import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

interface Ref<T> {
  instance: T;
  location: { nativeElement: HTMLElement };
  hostView: { destroyed: boolean; reattach(): void };
  changeDetectorRef: { detectChanges(): void };
  setInput(name: string, value: unknown): void;
  onDestroy(fn: () => void): void;
  destroy(): void;
}
type CreateComponent = <T>(type: unknown, options: Record<string, unknown>) => PromiseLike<Ref<T>>;

/** Porta de `old/test/core/create-component{,-string}.test.ts`. */
describe("etapa 6 — createComponent / ComponentRef (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "widgets.ts": `
import { Component, Input, OnChanges } from "ngjs-core";

@Component({ selector: "dyn-widget", template: "{{ $ctrl.title }}" })
export class Widget implements OnChanges {
  @Input() title = "";
  changes: any[] = [];
  ngOnChanges(changes: any): void { this.changes.push(changes); }
}

@Component({ selector: "dyn-card", template: '<div class="slot"><ngjs-projectable-node data-ngjs-projectable-node="0"></ngjs-projectable-node></div>' })
export class Card {}

@Component({ selector: "dyn-plain", template: "ok" })
export class Plain {}
`,
        "lazy.component.ts": `
import { Component, Input } from "ngjs-core";

/** No está declarado en ningún @NgModule: como el componente de un chunk lazy. */
@Component({ selector: "lazy-dyn-widget", template: "{{ $ctrl.label }}" })
export class LazyWidget { @Input() label = ""; }
`,
        "app.module.ts": `
import angular from "angular";
import { Component, NgModule, createComponent } from "ngjs-core";
import { Card, Plain, Widget } from "./widgets";

const legacy = angular
  .module("legacy", [])
  .directive("focusTrap", () => ({ link: (_s: unknown, el: any) => (globalThis as any).seenAttr.push(el[0].getAttribute("focus-trap")) }))
  .component("legacyCard", { bindings: { label: "@" }, controller: class LegacyCard { label = ""; }, template: "<span>{{$ctrl.label}}</span>" });
(globalThis as any).seenAttr = [];

@Component({ selector: "app-root", template: "" })
export class AppComponent {}

@NgModule({ imports: [legacy], declarations: [AppComponent, Widget, Card, Plain], bootstrap: [AppComponent] })
export class AppModule {}

(globalThis as any).fixture = { createComponent, Widget, Card, Plain, loadLazy: () => import("./lazy.component") };
`,
      },
      "<app-root></app-root>",
    );
    return app;
  }

  const fixture = () =>
    app!.global<{ createComponent: CreateComponent; Widget: unknown; Card: unknown; Plain: unknown; loadLazy(): Promise<{ LazyWidget: unknown }> }>("fixture");
  const mount = () => app!.document.body.appendChild(app!.document.createElement("div"));

  it("crea una instancia dinámica: instance/location/hostView/setInput/$onChanges/destroy", async () => {
    await boot();
    const host = mount();
    const ref = await fixture().createComponent<{ title: string; changes: { title: { currentValue: string; isFirstChange(): boolean } }[] }>(fixture().Widget, {
      injector: app!.injector,
      hostElement: host,
      bindings: { title: "hola" },
    });

    expect(ref.instance.title).toBe("hola");
    expect(ref.location.nativeElement.tagName.toLowerCase()).toBe("dyn-widget");
    expect(host.contains(ref.location.nativeElement)).toBe(true);
    expect(ref.hostView.destroyed).toBe(false);

    // El hostView arranca detached (como Angular): se adjunta a mano.
    ref.hostView.reattach();
    app!.digest();
    expect(ref.location.nativeElement.textContent).toContain("hola");

    ref.setInput("title", "actualizado");
    expect(ref.instance.title).toBe("actualizado");
    const last = ref.instance.changes.at(-1)!;
    expect(last.title.currentValue).toBe("actualizado");
    expect(last.title.isFirstChange()).toBe(false);

    let destroyedCallback = false;
    ref.onDestroy(() => {
      destroyedCallback = true;
    });
    ref.destroy();
    expect(destroyedCallback).toBe(true);
    expect(ref.hostView.destroyed).toBe(true);
    expect(host.contains(ref.location.nativeElement)).toBe(false);
    expect(() => ref.setInput("title", "tarde")).toThrow(/destruido/);
  });

  it("projectableNodes se proyectan dentro del host; directives agrega sus atributos al host", async () => {
    await boot();
    const projected = app!.document.createElement("b");
    projected.textContent = "proyectado";
    const card = await fixture().createComponent(fixture().Card, { injector: app!.injector, hostElement: mount(), projectableNodes: [[projected]] });
    expect(card.location.nativeElement.querySelector(".slot b")?.textContent).toBe("proyectado");

    await fixture().createComponent(fixture().Plain, { injector: app!.injector, hostElement: mount(), directives: ["focusTrap"] });
    expect(app!.global<string[]>("seenAttr")).toEqual([""]);
  });

  it("un @Component que no está en ningún módulo (cargado con import(), como un chunk lazy) se registra al vuelo", async () => {
    await boot();
    const { LazyWidget } = await fixture().loadLazy();
    expect(app!.injector.has("lazyDynWidgetDirective")).toBe(false);

    const ref = await fixture().createComponent<{ label: string }>(LazyWidget, { injector: app!.injector, hostElement: mount(), bindings: { label: "chunk" } });

    expect(app!.injector.has("lazyDynWidgetDirective")).toBe(true);
    expect(ref.instance.label).toBe("chunk");
  });

  it("por nombre de un componente AngularJS legacy: respeta bindings @", async () => {
    await boot();
    const host = mount();
    const ref = await fixture().createComponent<{ label: string }>("legacyCard", { environmentInjector: app!.injector, bindings: { label: "hola" } });

    host.appendChild(ref.location.nativeElement);
    ref.hostView.reattach();
    ref.changeDetectorRef.detectChanges();

    expect(ref.instance.constructor.name).toBe("LegacyCard");
    expect(host.querySelector("span")?.textContent).toBe("hola");
  });
});
