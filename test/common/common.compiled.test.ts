import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Porta de `old/test/common/{ng-container,ng-template-outlet,integration}.test.ts`. Antes cada test registraba los
 * bridges a mano en un `angular.module`; ahora el fixture se compila y los trae `NativeModule` (la plataforma).
 */
describe("etapa 8 — common: ng-container, ngTemplateOutlet y proyección (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  /** Un fixture con `AppComponent` (template + miembros dados) y lo que se agregue al archivo. */
  async function boot(template: string, members = "", extra = "", declarations = ""): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { AfterViewInit, Attribute, Component, ContentChild, Directive, ElementRef, HostBinding, HostListener, Injectable, Injector, Input, NgModule, OnInit, TemplateRef, ViewChild, ViewContainerRef } from "ngjs-core";
import { CommonModule, NgContainer } from "ngjs-core/common";
(globalThis as any).NgContainer = NgContainer;
${extra}
@Component({ selector: "app-root", template: ${JSON.stringify(template)} })
export class AppComponent {
${members}
}

@NgModule({ imports: [CommonModule], declarations: [AppComponent${declarations}], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();
    return app;
  }

  const root = <T>() => app!.controller<T>("app-root", "appRoot");
  const html = () => app!.document.querySelector("app-root")!;

  /** El controller de un `<ng-container>` (queda en el comentario ancla de `transclude: "element"`). */
  function ngContainerOf(parent: Element): { viewContainerRef: { insert(view: unknown): void; createComponent(type: unknown, options?: unknown): PromiseLike<unknown>; length: number } } {
    const walker = app!.document.createTreeWalker(parent, 128 /* SHOW_COMMENT */);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const controller = app!.global<{ of(node: Node): unknown }>("NgContainer").of(node);
      if (controller) return controller as ReturnType<typeof ngContainerOf>;
    }
    throw new Error("no hay un <ng-container> linkeado");
  }

  describe("<ng-container>", () => {
    it("no deja el tag en el DOM pero sí su contenido (como Angular)", async () => {
      await boot("<div><ng-container><span>hola</span></ng-container></div>");
      expect(html().querySelector("ng-container")).toBeNull();
      expect(html().querySelector("div > span")?.textContent).toBe("hola");
    });

    it("es ancla de un ViewContainerRef: un componente dinámico insertado ahí se limpia al destruirse", async () => {
      await boot(
        "<div><ng-container></ng-container></div>",
        "",
        '@Component({ selector: "dyn-card", template: "ok" })\nexport class DynCard {}',
        ", DynCard",
      );
      const container = ngContainerOf(html());
      await new Promise((resolve) => {
        container.viewContainerRef.createComponent("dynCard").then(resolve);
        app!.digest();
      });
      expect(html().querySelector("dyn-card")?.textContent).toBe("ok");

      app!.get<{ $destroy(): void }>("$rootScope").$destroy();
      expect(html().querySelector("dyn-card")).toBeNull();
    });
  });

  describe("*ngTemplateOutlet", () => {
    it("renderiza el template bindeado después del propio elemento del outlet, con su contexto ($implicit, ng-ref-read legacy)", async () => {
      await boot(
        '<ng-template ng-ref="$ctrl.tpl" ng-ref-read="ngTemplate" let-item="$implicit"><span>{{item}}</span></ng-template>' +
          "<div id=\"outlet\" ng-template-outlet=\"$ctrl.tpl\" ng-template-outlet-context=\"{$implicit: 'hola'}\"></div>",
      );
      const outlet = html().querySelector("#outlet")!;
      expect(outlet.nextElementSibling?.tagName).toBe("SPAN");
      expect(outlet.nextElementSibling?.textContent).toBe("hola");
    });

    it("let-x con una clave con nombre del contexto", async () => {
      await boot(
        '<ng-template ng-ref="$ctrl.tpl" let-name="who"><em>hola {{ name }}</em></ng-template><div ng-template-outlet="$ctrl.tpl" ng-template-outlet-context="$ctrl.ctx"></div>',
        '  tpl: unknown; ctx = { who: "Ana" };',
      );
      expect(html().querySelector("em")?.textContent).toBe("hola Ana");
    });

    it("cambiar el template bindeado destruye la vista anterior e inserta la nueva", async () => {
      await boot(
        '<ng-template ng-ref="$ctrl.tplA"><span class="a">A</span></ng-template>' +
          '<ng-template ng-ref="$ctrl.tplB"><span class="b">B</span></ng-template>' +
          '<div id="outlet" ng-template-outlet="$ctrl.current"></div>',
        "  tplA: unknown; tplB: unknown; current: unknown;",
      );
      const component = root<{ tplA: unknown; tplB: unknown; current: unknown }>();
      component.current = component.tplA;
      app!.digest();
      expect(html().querySelector(".a")).not.toBeNull();
      expect(html().querySelector(".b")).toBeNull();

      component.current = component.tplB;
      app!.digest();
      expect(html().querySelector(".a")).toBeNull();
      expect(html().querySelector(".b")).not.toBeNull();
    });

    it("sin template bindeado, no inserta nada", async () => {
      await boot('<div id="outlet" ng-template-outlet="$ctrl.ninguno"></div>');
      expect(html().querySelector("#outlet")!.nextElementSibling).toBeNull();
    });

    it("refleja una mutación in-place del objeto de contexto (sin cambiar la referencia)", async () => {
      await boot(
        '<ng-template ng-ref="$ctrl.tpl" let-fill="fill"><span>{{ fill }}</span></ng-template><div id="outlet" ng-template-outlet="$ctrl.tpl" ng-template-outlet-context="$ctrl.ctx"></div>',
        "  tpl: unknown; ctx = { fill: 50 };",
      );
      const outlet = html().querySelector("#outlet")!;
      expect(outlet.nextElementSibling?.textContent).toBe("50");

      // Mismo objeto, campo mutado — como hace NgbRating._updateState.
      root<{ ctx: { fill: number } }>().ctx.fill = 100;
      app!.digest();
      expect(outlet.nextElementSibling?.textContent).toBe("100");
    });

    it("al destruirse el outlet se limpia la vista embebida insertada", async () => {
      await boot(
        '<ng-template ng-ref="$ctrl.tpl"><span>hola</span></ng-template><div ng-if="$ctrl.show" id="outlet" ng-template-outlet="$ctrl.tpl"></div>',
        "  tpl: unknown; show = true;",
      );
      expect(html().querySelector("span")).not.toBeNull();

      root<{ show: boolean }>().show = false;
      app!.digest();
      expect(html().querySelector("span")).toBeNull();
    });
  });

  describe("integración: proyección/queries/ng-ref mezclados con todo lo demás", () => {
    it("padre con ElementRef + HostBinding + lifecycle + @ViewChild; hijo con @ContentChild sobre un nieto con providers/@Attribute/@HostListener propios", async () => {
      await boot(
        '<child><grandchild type="checkbox"></grandchild></child>',
        `  @ViewChild(ChildComponent) hijo?: ChildComponent;
  @HostBinding("class.ready") ready = false;
  initCalls = 0;
  sawChildAtAfterViewInit: unknown;
  constructor(public elementRef: ElementRef) {}
  ngOnInit(): void { this.initCalls++; }
  ngAfterViewInit(): void { this.sawChildAtAfterViewInit = this.hijo; }`,
        `@Injectable()
export class Greeter { greet(): string { return "hola"; } }

@Component({ selector: "grandchild", template: "ok", providers: [Greeter] })
export class GrandchildComponent {
  clicked = false;
  constructor(public elementRef: ElementRef, @Attribute("type") public type: string, public greeter: Greeter) {}
  @HostListener("click") onClick(): void { this.clicked = true; }
}

@Component({ selector: "child", template: "<ng-content></ng-content>" })
export class ChildComponent {
  @ContentChild(GrandchildComponent) proyectado?: GrandchildComponent;
}
`,
        ", ChildComponent, GrandchildComponent",
      );
      const parentEl = html();
      const grandchildEl = html().querySelector("grandchild")!;
      const parent = root<{ hijo: unknown; ready: boolean; initCalls: number; sawChildAtAfterViewInit: unknown; elementRef: { nativeElement: Element } }>();
      const child = app!.controller<{ proyectado: unknown }>("child", "child");
      const grandchild = app!.controller<{ elementRef: { nativeElement: Element }; type: string; clicked: boolean; greeter: { greet(): string } }>("grandchild", "grandchild");

      expect(grandchild.elementRef.nativeElement).toBe(grandchildEl);
      expect(grandchild.type).toBe("checkbox");
      expect(grandchild.greeter.greet()).toBe("hola");
      expect(child.proyectado).toBe(grandchild);
      expect(parent.hijo).toBe(child);
      expect(parent.sawChildAtAfterViewInit).toBe(child);
      expect(parent.initCalls).toBe(1);
      expect(parent.elementRef.nativeElement).toBe(parentEl);

      grandchildEl.dispatchEvent(new app!.window.MouseEvent("click"));
      expect(grandchild.clicked).toBe(true);

      parent.ready = true;
      app!.digest();
      expect(parentEl.classList.contains("ready")).toBe(true);
    });

    it("ViewContainerRef.createComponent + createEmbeddedView insertan juntos (también con el Injector público en { injector })", async () => {
      await boot(
        '<ng-template ng-ref="$ctrl.tpl" let-item="$implicit"><span>{{item}}</span></ng-template>',
        "  tpl!: TemplateRef<unknown>;\n  constructor(public vcr: ViewContainerRef, public injector: Injector) {}",
        '@Component({ selector: "dyn-card", template: "{{ $ctrl.label }}" })\nexport class DynCard { @Input() label = ""; }',
        ", DynCard",
      );
      const component = root<{ tpl: unknown; injector: unknown; vcr: { createEmbeddedView(tpl: unknown, ctx: unknown): unknown; createComponent(type: string, options: unknown): PromiseLike<unknown>; length: number } }>();
      component.vcr.createEmbeddedView(component.tpl, { $implicit: "embebido" });
      await new Promise((resolve) => {
        component.vcr.createComponent("dynCard", { injector: component.injector, bindings: { label: "componente" } }).then(resolve);
        app!.digest();
      });
      app!.digest();

      const parent = html().parentElement!;
      expect(Array.from(parent.querySelectorAll(":scope > span"), (el) => el.textContent)).toEqual(["embebido"]);
      expect(parent.querySelector("dyn-card")?.textContent).toBe("componente");
      expect(component.vcr.length).toBe(2);
    });

    it('@ViewChild("nombre") resuelve un TemplateRef publicado por ng-ref, y ese TemplateRef alimenta un *ngTemplateOutlet', async () => {
      await boot(
        "<ng-template ng-ref=\"tpl\" let-item=\"$implicit\"><span>{{item}}</span></ng-template><div ng-template-outlet=\"$ctrl.tpl\" ng-template-outlet-context=\"{$implicit: 'via-query'}\"></div>",
        '  @ViewChild("tpl") tpl?: TemplateRef<unknown>;',
      );
      expect(root<{ tpl: { createEmbeddedView: unknown } }>().tpl.createEmbeddedView).toBeTypeOf("function");
      expect(html().querySelector("span")?.textContent).toBe("via-query");
    });
  });
});
