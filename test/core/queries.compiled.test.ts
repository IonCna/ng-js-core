import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Porta de `old/test/core/queries/*` (view-child, view-children, content-child, ng-ref, ng-ref-export-as,
 * query-options, query-forward-ref, integration). Las queries las define el compilador (`ɵcmp.queries`/`viewQueries`)
 * y las resuelve `ng-ref-bridge` contra los candidatos que se publican al construirse.
 */
describe("etapas 7-8 — queries y ng-ref (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  const IMPORTS = `import { AfterContentInit, AfterViewInit, Component, ContentChild, ContentChildren, Directive, ElementRef, forwardRef, Input, NgModule, QueryList, TemplateRef, ViewChild, ViewChildren, ViewContainerRef } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";`;

  async function boot(code: string, declarations: string, html: string): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `${IMPORTS}
${code}
@NgModule({ imports: [CommonModule], declarations: [${declarations}] })
export class AppModule {}
`,
        "main.ts": `import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
(globalThis as any).ɵready = platformBrowserDynamic().bootstrapModule(AppModule);
`,
      },
      html,
    );
    app.digest();
    return app;
  }

  const ctrl = <T>(selector: string, name: string, index = 0) =>
    app!.angular.element(app!.document.querySelectorAll(selector)[index]!).controller(name) as T;

  describe("@ViewChild / @ViewChildren", () => {
    const tree = `
export class Base {}
@Component({ selector: "child", template: "child" })
export class Child extends Base {}
@Component({ selector: "other", template: "other" })
export class Other {}`;

    it("@ViewChild(Hijo) resuelve la instancia real del hijo (también por clase base), ya en ngAfterViewInit; sin match queda undefined", async () => {
      await boot(
        `${tree}
@Component({ selector: "parent", template: "<child></child>" })
export class Parent implements AfterViewInit {
  @ViewChild(Child) hijo?: Child;
  @ViewChild(Base) base?: Base;
  @ViewChild(Other) ninguno?: Other;
  seenAtInit: unknown;
  ngAfterViewInit(): void { this.seenAtInit = this.hijo; }
}`,
        "Parent, Child, Other",
        "<parent></parent>",
      );
      const parent = ctrl<{ hijo: unknown; base: unknown; ninguno: unknown; seenAtInit: unknown }>("parent", "parent");
      const child = ctrl("child", "child");
      expect(parent.hijo).toBe(child);
      expect(parent.base).toBe(child);
      expect(parent.ninguno).toBeUndefined();
      expect(parent.seenAtInit).toBe(child);
    });

    it("dos instancias del mismo padre (y dos padres hermanos con @ViewChildren) no se cruzan", async () => {
      await boot(
        `${tree}
@Component({ selector: "parent", template: "<child></child><child></child>" })
export class Parent {
  @ViewChild(Child) hijo?: Child;
  @ViewChildren(Child) hijos!: QueryList<Child>;
}`,
        "Parent, Child, Other",
        "<parent></parent><parent></parent>",
      );
      const [a, b] = [ctrl<{ hijo: unknown; hijos: { toArray(): unknown[] } }>("parent", "parent", 0), ctrl<{ hijo: unknown; hijos: { toArray(): unknown[] } }>("parent", "parent", 1)];
      const children = Array.from(app!.document.querySelectorAll("child"), (el) => app!.angular.element(el).controller("child"));
      expect(a.hijo).toBe(children[0]);
      expect(b.hijo).toBe(children[2]);
      expect(a.hijos.toArray()).toEqual(children.slice(0, 2));
      expect(b.hijos.toArray()).toEqual(children.slice(2));
    });

    it("@ViewChildren es un QueryList vivo; vacío sin match; changes no reproduce emisiones pasadas y completa al destruirse", async () => {
      await boot(
        `${tree}
@Component({ selector: "parent", template: "<child></child><child ng-if='$ctrl.third'></child><child></child>" })
export class Parent {
  third = false;
  @ViewChildren(Child) hijos!: QueryList<Child>;
  @ViewChildren(Other) otros!: QueryList<Other>;
}`,
        "Parent, Child, Other",
        "<parent></parent>",
      );
      const parent = ctrl<{ third: boolean; hijos: { length: number; changes: { subscribe(o: object): void } }; otros: { length: number } }>("parent", "parent");
      expect(parent.hijos.length).toBe(2);
      expect(parent.otros.length).toBe(0);

      const emissions: number[] = [];
      let completed = false;
      parent.hijos.changes.subscribe({ next: (list: { length: number }) => emissions.push(list.length), complete: () => (completed = true) });
      expect(emissions).toEqual([]);

      parent.third = true;
      app!.digest();
      expect(emissions).toEqual([3]);

      (app!.angular.element(app!.document.querySelector("parent")!).isolateScope() as unknown as { $destroy(): void }).$destroy();
      expect(completed).toBe(true);
    });
  });

  describe("@ContentChild / @ContentChildren + <ng-content>", () => {
    const tree = `
@Component({ selector: "nieto", template: "nieto" })
export class Nieto {}
@Component({ selector: "child", template: "<nieto class='own'></nieto><ng-content></ng-content>" })
export class Child implements AfterContentInit {
  @ContentChild(Nieto) proyectado?: Nieto;
  @ContentChildren(Nieto) todos!: QueryList<Nieto>;
  seenAtInit: unknown;
  ngAfterContentInit(): void { this.seenAtInit = this.proyectado; }
}`;

    it("resuelve el contenido PROYECTADO (no un descendiente del propio template); @ContentChildren junta todos", async () => {
      await boot(
        `${tree}
@Component({ selector: "parent", template: "<child><nieto class='p1'></nieto><nieto class='p2'></nieto></child>" })
export class Parent {}`,
        "Parent, Child, Nieto",
        "<parent></parent>",
      );
      const child = ctrl<{ proyectado: unknown; todos: { toArray(): unknown[] }; seenAtInit: unknown }>("child", "child");
      const projected = [".p1", ".p2"].map((selector) => app!.angular.element(app!.document.querySelector(selector)!).controller("nieto"));
      expect(child.proyectado).toBe(projected[0]);
      expect(child.seenAtInit).toBe(projected[0]);
      expect(child.todos.toArray()).toEqual(projected);
    });

    it("descendants: false solo cuenta las raíces proyectadas", async () => {
      await boot(
        `@Directive({ selector: "[marker]" })
export class Marker {}
@Component({ selector: "host-cmp", template: "<ng-content></ng-content>" })
export class HostCmp {
  @ContentChildren(Marker, { descendants: false }) direct!: QueryList<Marker>;
  @ContentChildren(Marker, { descendants: true }) all!: QueryList<Marker>;
}
@Component({ selector: "parent", template: "<host-cmp><span marker></span><div><span marker></span></div></host-cmp>" })
export class Parent {}`,
        "Parent, HostCmp, Marker",
        "<parent></parent>",
      );
      const host = ctrl<{ direct: { length: number }; all: { length: number } }>("host-cmp", "hostCmp");
      expect(host.direct.length).toBe(1);
      expect(host.all.length).toBe(2);
    });

    it("forwardRef en el locator (light DOM de una @Directive): se resuelve al usarse, no al decorar", async () => {
      await boot(
        `@Directive({ selector: "[fwHost]" })
export class FwHost {
  @ContentChildren(forwardRef(() => FwItem)) items!: QueryList<unknown>;
  @ContentChild(forwardRef(() => FwItem)) first!: unknown;
}
@Directive({ selector: "[fwItem]" })
export class FwItem { tag = "item"; }`,
        "FwHost, FwItem",
        "<div fw-host><span fw-item></span><span fw-item></span></div>",
      );
      const host = ctrl<{ items: { length: number }; first: { tag: string } }>("[fw-host]", "fwHost");
      expect(host.items.length).toBe(2);
      expect(host.first.tag).toBe("item");
    });
  });

  describe("ng-ref (#ref) y read", () => {
    it("sin ng-ref-read asigna el ElementRef a la expresión; $destroy la limpia; @ViewChild(\"nombre\") lo resuelve y otro nombre no", async () => {
      await boot(
        `@Component({ selector: "widget", template: "<div ng-ref='$ctrl.captured'></div><p ng-ref='myThing'></p>" })
export class Widget {
  captured: unknown;
  @ViewChild("myThing") capturado?: ElementRef;
  @ViewChild("otroNombre") otro?: ElementRef;
}`,
        "Widget",
        "<widget></widget>",
      );
      const widget = ctrl<{ captured: { nativeElement: Element } | null; capturado: { nativeElement: Element }; otro: unknown }>("widget", "widget");
      expect(widget.captured?.nativeElement).toBe(app!.document.querySelector("widget div"));
      expect(widget.capturado.nativeElement).toBe(app!.document.querySelector("widget p"));
      expect(widget.otro).toBeUndefined();

      (app!.angular.element(app!.document.querySelector("widget")!).isolateScope() as unknown as { $destroy(): void }).$destroy();
      expect(widget.captured).toBeNull();
    });

    it('ng-ref-read="ElementRef" da el ElementRef; un exportAs da la instancia; "TemplateRef" sobre <ng-template> da el TemplateRef', async () => {
      await boot(
        `@Directive({ selector: "[fooDir]", exportAs: "bar" })
export class FooDir { readonly tag = "soy-foo"; }
@Component({
  selector: "exp-root",
  template: "<div foo-dir ng-ref='asEl' ng-ref-read='ElementRef'></div><div foo-dir ng-ref='asDir' ng-ref-read='bar'></div><ng-template ng-ref='tpl' ng-ref-read='TemplateRef'>x</ng-template>",
})
export class Root {
  @ViewChild("asEl") asEl?: ElementRef;
  @ViewChild("asDir") asDir?: FooDir;
  @ViewChild("tpl") tpl?: TemplateRef<unknown>;
}`,
        "Root, FooDir",
        "<exp-root></exp-root>",
      );
      const root = ctrl<{ asEl: { nativeElement: Element }; asDir: { tag: string }; tpl: { createEmbeddedView: unknown } }>("exp-root", "expRoot");
      expect(root.asEl.nativeElement.hasAttribute("foo-dir")).toBe(true);
      expect(root.asDir.tag).toBe("soy-foo");
      expect(root.tpl.createEmbeddedView).toBeTypeOf("function");
    });

    it("read: ViewContainerRef (con ng-ref-read y sobre un <ng-container #x> pelado), read: ElementRef por clase, read: TemplateRef en contenido", async () => {
      await boot(
        `@Component({ selector: "child", template: "child" })
export class Child {}
@Directive({ selector: "[headerMarker]" })
export class HeaderMarker { constructor(public templateRef: TemplateRef<unknown>) {} }
@Component({ selector: "tabs", template: "<ng-content></ng-content>" })
export class Tabs { @ContentChild(HeaderMarker, { read: TemplateRef, static: true }) template?: TemplateRef<unknown>; }
@Component({
  selector: "host-cmp",
  template: "<child ng-ref='container' ng-ref-read='viewContainerRef'></child><ng-container ng-ref='bare'></ng-container><tabs><ng-template header-marker>header</ng-template></tabs>",
})
export class HostCmp {
  @ViewChild("container", { read: ViewContainerRef, static: true }) vcr?: ViewContainerRef;
  @ViewChild("bare", { read: ViewContainerRef, static: true }) bareVcr?: ViewContainerRef;
  @ViewChild(Child, { read: ElementRef }) childElement?: ElementRef<HTMLElement>;
}`,
        "HostCmp, Child, HeaderMarker, Tabs",
        "<host-cmp></host-cmp>",
      );
      const host = ctrl<{ vcr: { createEmbeddedView: unknown }; bareVcr: { createEmbeddedView: unknown }; childElement: { nativeElement: Element } }>("host-cmp", "hostCmp");
      expect(host.vcr.createEmbeddedView).toBeTypeOf("function");
      expect(host.bareVcr.createEmbeddedView).toBeTypeOf("function");
      expect(host.childElement.nativeElement).toBe(app!.document.querySelector("child"));
      expect(ctrl<{ template: { createEmbeddedView: unknown } }>("tabs", "tabs").template.createEmbeddedView).toBeTypeOf("function");
    });
  });
});
