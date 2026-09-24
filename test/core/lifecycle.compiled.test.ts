import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Porta de `old/test/core/lifecycle/*` (lifecycle, host-binding, host-listener, attribute, element-ref, destroy-ref,
 * async-pipe, view-container-ref, scoped-injector e integración). Antes cada bridge se registraba a mano sobre
 * `$controller`; ahora parte del wiring lo emite el compilador (lifecycle, host, `@Attribute`, injector por
 * elemento) y el resto lo pone `NativeModule` — acá se prueba el resultado sobre AngularJS real.
 */
describe("etapa 5 — componentes compilados: lifecycle, host, @Attribute, tokens por elemento, DI jerárquica", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  /** `widget.ts` con lo dado + un `AppModule` que declara `declarations` y monta `html` en el body. */
  async function boot(widget: string, declarations: string, html: string): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "widget.ts": `
import { AfterContentChecked, AfterContentInit, AfterViewChecked, AfterViewInit, Attribute, ChangeDetectorRef, Component, DestroyRef, Directive, DoCheck, ElementRef, Host, HostBinding, HostListener, Inject, Injectable, InjectionToken, Input, OnChanges, OnDestroy, OnInit, Optional, Self, SkipSelf, ViewContainerRef } from "ngjs-core";
import { AsyncPipe } from "ngjs-core/common";
${widget}
`,
        "app.module.ts": `
import { NgModule } from "ngjs-core";
import { ${declarations} } from "./widget";

@NgModule({ declarations: [${declarations}] })
export class AppModule {}
`,
        "main.ts": `
import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
(globalThis as any).ɵready = platformBrowserDynamic().bootstrapModule(AppModule);
`,
      },
      html,
    );
    app.digest();
    return app;
  }

  const $rootScope = () => app!.get<{ $digest(): void; $destroy(): void } & Record<string, unknown>>("$rootScope");
  const all = <T>(selector: string, name: string) =>
    Array.from(app!.document.querySelectorAll(selector), (el) => app!.angular.element(el).controller(name) as T);

  describe("lifecycle hooks", () => {
    it("ngOnInit corre una sola vez al instanciar; una clase sin hooks no explota", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget implements OnInit { calls: string[] = []; ngOnInit(): void { this.calls.push("init"); } }
@Component({ selector: "plain-widget", template: "ok" })
export class PlainWidget {}`,
        "Widget, PlainWidget",
        "<widget></widget><plain-widget></plain-widget>",
      );
      $rootScope().$digest();
      expect(app!.controller<{ calls: string[] }>("widget", "widget").calls).toEqual(["init"]);
    });

    it("ngOnChanges recibe currentValue/previousValue/isFirstChange()", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget implements OnChanges {
  @Input() count!: number;
  seen: { current: unknown; previous: unknown; first: boolean }[] = [];
  ngOnChanges(changes: any): void {
    if (changes.count) this.seen.push({ current: changes.count.currentValue, previous: changes.count.previousValue, first: changes.count.isFirstChange() });
  }
}`,
        "Widget",
        '<widget count="n"></widget>',
      );
      $rootScope().n = 1;
      $rootScope().$digest();
      $rootScope().n = 2;
      $rootScope().$digest();

      const seen = app!.controller<{ seen: { current: unknown; previous: unknown; first: boolean }[] }>("widget", "widget").seen;
      expect(seen.some((change) => change.first)).toBe(true);
      expect(seen.find((change) => change.current === 1)).toBeDefined();
      expect(seen.find((change) => change.current === 2)).toMatchObject({ previous: 1, first: false });
    });

    it("ngOnDestroy corre al destruirse el scope; ngDoCheck corre en cada $digest", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget implements OnDestroy, DoCheck {
  calls: string[] = [];
  ngOnDestroy(): void { this.calls.push("destroy"); }
  ngDoCheck(): void { this.calls.push("doCheck"); }
}`,
        "Widget",
        "<widget></widget>",
      );
      const widget = app!.controller<{ calls: string[] }>("widget", "widget");
      const afterFirst = widget.calls.filter((call) => call === "doCheck").length;
      $rootScope().$digest();
      expect(afterFirst).toBeGreaterThanOrEqual(1);
      expect(widget.calls.filter((call) => call === "doCheck").length).toBeGreaterThan(afterFirst);
      expect(widget.calls).not.toContain("destroy");

      $rootScope().$destroy();
      expect(widget.calls.at(-1)).toBe("destroy");
    });

    it("ngAfterContentChecked/ngAfterViewChecked: en orden tras ngDoCheck, y recién después de los Init", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget implements DoCheck, AfterContentChecked, AfterViewChecked {
  calls: string[] = [];
  ngDoCheck(): void { this.calls.push("doCheck"); }
  ngAfterContentChecked(): void { this.calls.push("contentChecked"); }
  ngAfterViewChecked(): void { this.calls.push("viewChecked"); }
}`,
        "Widget",
        "<widget></widget>",
      );
      $rootScope().$digest();
      const calls = app!.controller<{ calls: string[] }>("widget", "widget").calls;
      expect(calls[0]).toBe("doCheck");
      expect(calls[1]).not.toBe("contentChecked"); // el $doCheck inicial es antes del $postLink
      expect(calls).toContain("contentChecked");
      expect(calls.indexOf("contentChecked")).toBeLessThan(calls.indexOf("viewChecked"));
    });

    it("ngAfterContentInit antes que ngAfterViewInit (también con solo uno de los dos)", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget implements AfterViewInit, AfterContentInit {
  calls: string[] = [];
  ngAfterViewInit(): void { this.calls.push("view"); }
  ngAfterContentInit(): void { this.calls.push("content"); }
}
@Component({ selector: "view-only", template: "ok" })
export class ViewOnly implements AfterViewInit { calls: string[] = []; ngAfterViewInit(): void { this.calls.push("view"); } }`,
        "Widget, ViewOnly",
        "<widget></widget><view-only></view-only>",
      );
      expect(app!.controller<{ calls: string[] }>("widget", "widget").calls).toEqual(["content", "view"]);
      expect(app!.controller<{ calls: string[] }>("view-only", "viewOnly").calls).toEqual(["view"]);
    });
  });

  describe("@HostBinding", () => {
    it("class./style./attr. y propiedad plana; attr.aria con false escribe \"false\" y null lo quita; se desregistra en $destroy", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget {
  @HostBinding("class.active") isActive = false;
  @HostBinding("style.color") color = "red";
  @HostBinding("attr.aria-label") label: string | null = "hola";
  @HostBinding("attr.aria-expanded") expanded = true;
  @HostBinding("id") elId = "my-id";
}`,
        "Widget",
        "<widget></widget>",
      );
      const el = app!.document.querySelector("widget") as HTMLElement;
      const widget = app!.controller<{ isActive: boolean; label: string | null; expanded: boolean }>("widget", "widget");
      expect(el.classList.contains("active")).toBe(false);
      expect(el.style.color).toBe("red");
      expect(el.getAttribute("aria-label")).toBe("hola");
      expect(el.getAttribute("aria-expanded")).toBe("true");
      expect(el.id).toBe("my-id");

      widget.isActive = true;
      widget.label = null;
      widget.expanded = false;
      $rootScope().$digest();
      expect(el.classList.contains("active")).toBe(true);
      expect(el.hasAttribute("aria-label")).toBe(false);
      expect(el.getAttribute("aria-expanded")).toBe("false");

      (app!.angular.element(el).isolateScope() as unknown as { $destroy(): void }).$destroy();
      widget.isActive = false;
      expect(() => $rootScope().$digest()).not.toThrow();
      expect(el.classList.contains("active")).toBe(true); // el watch ya no está
    });
  });

  describe("@HostListener", () => {
    it("un click en el host dispara el método; instancias independientes; varios listeners; filtro de tecla", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget {
  clicks = 0;
  keys: string[] = [];
  @HostListener("click") onClick(): void { this.clicks++; }
  @HostListener("mouseover") onOver(): void { this.keys.push("over"); }
  @HostListener("keydown.arrowdown") onDown(): void { this.keys.push("down"); }
  @HostListener("keydown.shift.tab") onBackTab(): void { this.keys.push("shift+tab"); }
}`,
        "Widget",
        "<widget id='a'></widget><widget id='b'></widget>",
      );
      const [a, b] = Array.from(app!.document.querySelectorAll("widget"));
      const { MouseEvent, KeyboardEvent } = app!.window;
      a!.dispatchEvent(new MouseEvent("click"));
      a!.dispatchEvent(new MouseEvent("mouseover"));
      a!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      a!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      a!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
      a!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));

      const [widgetA, widgetB] = all<{ clicks: number; keys: string[] }>("widget", "widget");
      expect(widgetA!.clicks).toBe(1);
      expect(widgetA!.keys).toEqual(["over", "down", "shift+tab"]);
      expect(widgetB!.clicks).toBe(0);
      b!.dispatchEvent(new MouseEvent("click"));
      expect(widgetB!.clicks).toBe(1);
    });
  });

  describe("@Attribute", () => {
    it("recibe el valor literal (no bindeado, no reactivo), por instancia, también en directivas de atributo y dos en el mismo tag", async () => {
      await boot(
        `@Component({ selector: "widget", template: "ok" })
export class Widget { constructor(@Attribute("type") public type: string) {} }
@Directive({ selector: "[appRole]" })
export class RoleDirective { constructor(@Attribute("role") public role: string) {} }
@Directive({ selector: "[appKind]" })
export class KindDirective { constructor(@Attribute("kind") public kind: string) {} }`,
        "Widget, RoleDirective, KindDirective",
        "<widget type='{{ nope }}'></widget><widget type='checkbox'></widget><div app-role app-kind role='button' kind='primary'></div>",
      );
      const [first, second] = all<{ type: string }>("widget", "widget");
      expect(first!.type).toBe("{{ nope }}");
      expect(second!.type).toBe("checkbox");

      app!.document.querySelectorAll("widget")[1]!.setAttribute("type", "radio");
      $rootScope().$digest();
      expect(second!.type).toBe("checkbox");

      const div = app!.angular.element(app!.document.querySelector("div")!);
      expect((div.controller("appRole") as { role: string }).role).toBe("button");
      expect((div.controller("appKind") as { kind: string }).kind).toBe("primary");
    });
  });

  describe("tokens por elemento", () => {
    it("ElementRef, DestroyRef, ChangeDetectorRef, ViewContainerRef y AsyncPipe: uno propio por instancia", async () => {
      await boot(
        `@Component({ selector: "widget", template: "{{ $ctrl.async.transform($ctrl.value$) }}" })
export class Widget {
  destroyed = false;
  value$ = new (class { subscribe(fn: (v: string) => void) { fn("emitido"); return { unsubscribe() {} }; } })();
  constructor(
    public el: ElementRef,
    destroyRef: DestroyRef,
    public cdr: ChangeDetectorRef,
    public vcr: ViewContainerRef,
    public async: AsyncPipe,
  ) {
    destroyRef.onDestroy(() => (this.destroyed = true));
  }
}
@Component({ selector: "plain", template: "ok" })
export class Plain {}`,
        "Widget, Plain",
        "<widget></widget><widget></widget><plain></plain>",
      );
      $rootScope().$digest();
      const elements = Array.from(app!.document.querySelectorAll("widget"));
      const [a, b] = all<{ el: { nativeElement: Element }; destroyed: boolean; cdr: object; vcr: { element: { nativeElement: Element } }; async: object }>("widget", "widget");
      expect(a!.el.nativeElement).toBe(elements[0]);
      expect(b!.el.nativeElement).toBe(elements[1]);
      expect(a!.vcr.element.nativeElement).toBe(elements[0]);
      expect(a!.cdr).not.toBe(b!.cdr);
      expect(a!.async).not.toBe(b!.async);
      expect(elements[0]!.textContent).toBe("emitido");

      (app!.angular.element(elements[0]!).isolateScope() as unknown as { $destroy(): void }).$destroy();
      expect(a!.destroyed).toBe(true);
      expect(b!.destroyed).toBe(false);
    });
  });

  describe("inyector jerárquico (providers de @Component)", () => {
    const services = `
export const LABEL = new InjectionToken<string>("LABEL");
@Injectable()
export class Counter {
  static created = 0;
  static destroyed = 0;
  readonly id = ++Counter.created;
  ngOnDestroy(): void { Counter.destroyed++; }
}
(globalThis as any).Counter = Counter;
`;

    it("resuelve contra sus providers; cada instancia su nodo; un hijo sin providers hereda el del padre; teardown llama ngOnDestroy", async () => {
      await boot(
        `${services}
@Component({ selector: "child-widget", template: "ok" })
export class ChildWidget { constructor(public counter: Counter) {} }

@Component({ selector: "widget", template: "<child-widget></child-widget>", providers: [Counter] })
export class Widget { constructor(public counter: Counter) {} }`,
        "Widget, ChildWidget",
        "<widget></widget><widget></widget>",
      );
      const [a, b] = all<{ counter: { id: number } }>("widget", "widget");
      const [childA] = all<{ counter: { id: number } }>("child-widget", "childWidget");
      expect(a!.counter).not.toBe(b!.counter);
      expect(childA!.counter).toBe(a!.counter);

      $rootScope().$destroy();
      expect(app!.global<{ destroyed: number }>("Counter").destroyed).toBe(2);
    });

    it("@SkipSelf salta el propio; sin flags gana el propio; @Self no sube; @Optional da null si nadie lo provee", async () => {
      await boot(
        `${services}
@Component({ selector: "inner-widget", template: "ok", providers: [{ provide: LABEL, useValue: "inner" }] })
export class InnerWidget {
  constructor(
    @Inject(LABEL) public own: string,
    @SkipSelf() @Inject(LABEL) public parent: string,
    @Self() @Optional() public selfCounter: Counter | null,
    @Optional() @Inject("nadie") public missing: unknown,
  ) {}
}

@Component({ selector: "widget", template: "<inner-widget></inner-widget>", providers: [{ provide: LABEL, useValue: "outer" }, Counter] })
export class Widget {}`,
        "Widget, InnerWidget",
        "<widget></widget>",
      );
      const inner = app!.controller<{ own: string; parent: string; selfCounter: unknown; missing: unknown }>("inner-widget", "innerWidget");
      expect(inner.own).toBe("inner");
      expect(inner.parent).toBe("outer");
      expect(inner.selfCounter).toBeNull();
      expect(inner.missing).toBeNull();
    });
  });

  describe("integración", () => {
    it("providers + ElementRef + @Attribute + @HostListener + @HostBinding + lifecycle, todo en un solo controller; el hijo sin providers resuelve DI jerárquica + ElementRef + @Attribute", async () => {
      await boot(
        `@Injectable()
export class Greeter { greet(): string { return "hola"; } }

@Component({ selector: "child-widget", template: "ok" })
export class ChildWidget {
  constructor(public greeter: Greeter, public el: ElementRef, @Attribute("kind") public kind: string) {}
}

@Component({ selector: "widget", template: "<child-widget kind='hijo'></child-widget>", providers: [Greeter] })
export class Widget implements OnInit, OnDestroy {
  calls: string[] = [];
  clicked = false;
  @HostBinding("class.ready") ready = false;
  constructor(public greeter: Greeter, public el: ElementRef, @Attribute("type") public type: string) {}
  @HostListener("click") onClick(): void { this.clicked = true; this.ready = true; }
  ngOnInit(): void { this.calls.push("init:" + this.greeter.greet()); }
  ngOnDestroy(): void { this.calls.push("destroy"); }
}`,
        "Widget, ChildWidget",
        "<widget type='checkbox'></widget>",
      );
      const el = app!.document.querySelector("widget")!;
      const widget = app!.controller<{ calls: string[]; clicked: boolean; greeter: unknown; el: { nativeElement: Element }; type: string }>("widget", "widget");
      const child = app!.controller<{ greeter: unknown; el: { nativeElement: Element }; kind: string }>("child-widget", "childWidget");

      expect(widget.calls).toEqual(["init:hola"]);
      expect(widget.el.nativeElement).toBe(el);
      expect(widget.type).toBe("checkbox");
      expect(child.greeter).toBe(widget.greeter);
      expect(child.el.nativeElement).toBe(el.querySelector("child-widget"));
      expect(child.kind).toBe("hijo");

      el.dispatchEvent(new app!.window.MouseEvent("click"));
      expect(widget.clicked).toBe(true);
      expect(el.classList.contains("ready")).toBe(true);

      $rootScope().$destroy();
      expect(widget.calls).toEqual(["init:hola", "destroy"]);
    });
  });
});
