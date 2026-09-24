import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

const MAIN = `import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
(globalThis as any).ɵready = platformBrowserDynamic().bootstrapModule(AppModule);
`;

const IMPORTS = `import { Component, Directive, ElementRef, EventEmitter, Injectable, InjectionToken, Input, NgModule, OnInit, Output, Pipe, inject } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";`;

/**
 * Porta de `old/test/runtime/*` (menos forms — `forms.compiled.test.ts` — y `host-directives` — `views.compiled.test.ts`).
 * Lo que antes hacía el motor de runtime (`registerNgModule`, `bootstrapApplication` caminando `ɵmod`) ahora lo emite
 * el compilador; estos tests verifican que el resultado se comporta igual.
 */
describe("runtime: bootstrap, módulos, directivas y DI (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(module: string, html = ""): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap({ "app.module.ts": `${IMPORTS}\n${module}`, "main.ts": MAIN }, html);
    app.digest();
    return app;
  }

  const text = (selector: string) => app!.document.querySelector(selector)?.textContent?.trim();

  describe("@NgModule({ bootstrap })", () => {
    it("crea el elemento del componente raíz y lo compila; no lo duplica si ya está; monta varios; acepta un selector en camelCase", async () => {
      await boot(
        `@Component({ selector: "nb-root", template: "<span>raíz {{ $ctrl.n }}</span>" })
export class NbRoot { n = 1; }
@Component({ selector: "nb-existing", template: "<u>x</u>" })
export class NbExisting {}
@Component({ selector: "nbKebabCamel", template: "<span>k</span>" })
export class NbKebabCamel {}
@NgModule({ imports: [CommonModule], declarations: [NbRoot, NbExisting, NbKebabCamel], bootstrap: [NbRoot, NbExisting, NbKebabCamel] })
export class AppModule {}`,
        "<nb-existing></nb-existing>",
      );
      expect(text("nb-root")).toContain("raíz 1");
      expect(app!.document.querySelectorAll("nb-existing")).toHaveLength(1);
      expect(text("nb-existing u")).toBe("x");
      expect(text("nb-kebab-camel")).toBe("k");
    });

    it("el `bootstrap` de un @NgModule importado se ignora (fiel a Angular); sin bootstrap el body se compila tal cual", async () => {
      await boot(
        `@Component({ selector: "cb-child-root", template: "<span>CHILD</span>" })
export class ChildRoot {}
@NgModule({ declarations: [ChildRoot], bootstrap: [ChildRoot] })
export class ChildModule {}
@Component({ selector: "cb-root", template: "<span>ROOT</span>" })
export class RootComp {}
@NgModule({ imports: [ChildModule], declarations: [RootComp], bootstrap: [RootComp] })
export class AppModule {}`,
      );
      expect(text("cb-root")).toBe("ROOT");
      expect(app!.document.querySelector("cb-child-root")).toBeNull();
    });

    it("errores de build: un `bootstrap` que no es @Component de sus declarations, o con selector de atributo", async () => {
      const compile = (module: string) => CompiledApp.compileOnly({ "app.module.ts": `${IMPORTS}\n${module}`, "main.ts": MAIN });
      await expect(
        compile(`@Component({ selector: "nb-undeclared", template: "x" })
export class NbUndeclared {}
@NgModule({ bootstrap: [NbUndeclared] })
export class AppModule {}`),
      ).rejects.toThrow(/no es un @Component de sus declarations/);
      await expect(
        compile(`@Directive({ selector: "[nbAttr]" })
export class NbAttr {}
@NgModule({ declarations: [NbAttr], bootstrap: [NbAttr] })
export class AppModule {}`),
      ).rejects.toThrow(/no es un @Component de sus declarations/);
      await expect(
        compile(`@Component({ selector: "[nbAttrCmp]", template: "x" })
export class NbAttrCmp {}
@NgModule({ declarations: [NbAttrCmp], bootstrap: [NbAttrCmp] })
export class AppModule {}`),
      ).rejects.toThrow(/selector de atributo|selector de elemento/);
    });
  });

  it("controllerAs de @NgModule (3 capas): el del @Component gana, si no el de su módulo, si no el del que lo importa; sin ninguno $ctrl", async () => {
    await boot(
      `@Component({ selector: "ca-grandchild", template: "<span>{{ $.v }}</span>" })
export class Grandchild { v = "gc"; }
@NgModule({ declarations: [Grandchild] })
export class GrandModule {}
@Component({ selector: "ca-child", template: "<span>{{ $.v }}</span>" })
export class Child { v = "c"; }
@Component({ selector: "ca-own", controllerAs: "vm", template: "<span>{{ vm.v }}</span>" })
export class Own { v = "own"; }
@Component({ selector: "ca-root", template: "<ca-child></ca-child><ca-own></ca-own><ca-grandchild></ca-grandchild>" })
export class Root {}
@NgModule({ controllerAs: "$", imports: [GrandModule], declarations: [Root, Child, Own], bootstrap: [Root] })
export class AppModule {}`,
    );
    expect(text("ca-child span")).toBe("c");
    expect(text("ca-own span")).toBe("own");
    expect(text("ca-grandchild span")).toBe("gc");
  });

  describe("@Directive sobre markup suelto ($compile)", () => {
    const probes = `
@Directive({ selector: "[probeA]" })
export class ProbeA implements OnInit {
  @Input() probeValue = "DEFAULT";
  calls: string[] = [];
  ngOnInit(): void { this.calls.push("ngOnInit:" + this.probeValue); }
}
@Directive({ selector: "[probeC]" })
export class ProbeC implements OnInit {
  @Input() probeValue = "DEFAULT";
  @Output() probeChange = new EventEmitter<string>();
  calls: string[] = [];
  ngOnInit(): void { this.calls.push("ngOnInit:" + this.probeValue); this.probeChange.emit(this.probeValue); }
}
@Directive({ selector: "[bm]" })
export class BindingMode implements OnInit {
  @Input({ binding: "@" }) label: string | undefined;
  @Input({ binding: "@" }) cssClass: string | undefined;
  @Input({ binding: "@", alias: "aliased" }) viaAlias: string | undefined;
  @Input({ binding: "@" }) interpolated: string | undefined;
  @Input() expr: unknown;
  seen: Record<string, unknown> = {};
  ngOnInit(): void { this.seen = { label: this.label, cssClass: this.cssClass, viaAlias: this.viaAlias, interpolated: this.interpolated, expr: this.expr }; }
}
`;

    it("dispara ngOnInit con el @Input bindeado (también con un @Output que emite en ngOnInit, y con controllerAs de módulo)", async () => {
      await boot(
        `${probes}
@NgModule({ controllerAs: "$", declarations: [ProbeA, ProbeC, BindingMode] })
export class AppModule {}`,
      );
      const a = app!.compile(`<div probe-a probe-value="'BOUND'"></div>`);
      expect((a.element.controller("probeA") as { calls: string[]; probeValue: string }).calls).toEqual(["ngOnInit:BOUND"]);

      const emitted: string[] = [];
      const c = app!.compile(`<div probe-c probe-value="'BOUND'" probe-change="onChange($event)"></div>`, { onChange: (v: string) => emitted.push(v) });
      expect((c.element.controller("probeC") as { calls: string[] }).calls).toEqual(["ngOnInit:BOUND"]);
      expect(emitted).toEqual(["BOUND"]);
    });

    it('@Input({ binding: "@" }) toma el valor crudo del atributo (espacios, puntuación, alias, interpolación); @Input() a secas es expresión', async () => {
      await boot(
        `${probes}
@NgModule({ declarations: [ProbeA, ProbeC, BindingMode] })
export class AppModule {}`,
      );
      const { element } = app!.compile(
        `<div bm label="Great tip!" css-class="btn btn-primary" aliased="hola" interpolated="hola {{ name }}" expr="n"></div>`,
        { name: "mundo", n: 42 },
      );
      expect((element.controller("bm") as { seen: object }).seen).toEqual({
        label: "Great tip!",
        cssClass: "btn btn-primary",
        viaAlias: "hola",
        interpolated: "hola mundo",
        expr: 42,
      });
    });

    it("grafo mixto: un @NgModule con controllerAs que importa un angular.module crudo y un @NgModule con una @Directive — ngOnInit dispara", async () => {
      await boot(
        `import angular from "angular";
${probes}
const legacyModule = angular.module("legacy.mixed.mod", []).directive("legacyNoop", () => ({ restrict: "A" }));
@NgModule({ declarations: [ProbeA] })
export class LeafModule {}
@NgModule({ controllerAs: "$", imports: [LeafModule, legacyModule.name] })
export class AppModule {}`,
      );
      const { element } = app!.compile(`<div probe-a legacy-noop probe-value="'BOUND'"></div>`);
      expect((element.controller("probeA") as { calls: string[] }).calls).toEqual(["ngOnInit:BOUND"]);
    });
  });

  describe("DI", () => {
    it("inject(ClaseDeComponente) da la instancia del ancestro; con { optional: true } y sin ancestro, null", async () => {
      await boot(
        `@Component({ selector: "di-other", template: "y" })
export class Other {}
@Component({ selector: "di-child", template: "x" })
export class Child {
  readonly parent = inject(Parent);
  readonly other = inject(Other, { optional: true });
}
@Component({ selector: "di-parent", template: "<di-child></di-child>" })
export class Parent { readonly tag = "soy-el-parent"; }
@NgModule({ declarations: [Parent, Child, Other], bootstrap: [Parent] })
export class AppModule {}`,
      );
      const child = app!.controller<{ parent: { tag: string }; other: unknown }>("di-child", "diChild");
      expect(child.parent.tag).toBe("soy-el-parent");
      expect(child.other).toBeNull();
    });

    it("inject() en field initializer: servicio de app y ElementRef por instancia; { optional } da null; { skipSelf } salta lo del elemento", async () => {
      await boot(
        `@Injectable()
export class Greeter { hi(): string { return "hola"; } }
@Injectable()
export class Missing {}
@Component({ selector: "inj-child", template: "<span>{{ $ctrl.text }}</span>" })
export class Child implements OnInit {
  private readonly greeter = inject(Greeter);
  private readonly elementRef = inject(ElementRef);
  readonly missing = inject(Missing, { optional: true });
  readonly parentElementRef = inject(ElementRef, { skipSelf: true, optional: true });
  text = "";
  ngOnInit(): void { this.text = this.greeter.hi() + ":" + (this.elementRef.nativeElement as HTMLElement).tagName.toLowerCase(); }
}
@Component({ selector: "inj-root", template: "<inj-child></inj-child>" })
export class Root {}
@NgModule({ declarations: [Root, Child], providers: [Greeter], bootstrap: [Root] })
export class AppModule {}
(globalThis as any).fixture = { inject, Greeter };`,
      );
      app!.digest();
      expect(text("inj-child span")).toBe("hola:inj-child");
      const child = app!.controller<{ missing: unknown; parentElementRef: unknown }>("inj-child", "injChild");
      expect(child.missing).toBeNull();
      expect(child.parentElementRef).toBeNull();

      // Fuera de una construcción, inject() usa el injector de la app.
      const { inject: runtimeInject, Greeter } = app!.global<{ inject(token: unknown): { hi(): string }; Greeter: unknown }>("fixture");
      expect(runtimeInject(Greeter).hi()).toBe("hola");
    });

    it("recetas de provider: useValue / useFactory+deps / useExisting / multi; un módulo importado dos veces deja un singleton", async () => {
      await boot(
        `export const API_URL = new InjectionToken<string>("API_URL");
export const MULTI = new InjectionToken<string[]>("MULTI");
@Injectable()
export class Base { tag = "base"; }
@Injectable()
export class Counter { static instances = 0; constructor() { Counter.instances += 1; } }
@NgModule({ providers: [Counter] })
export class FeatureModule {}
@NgModule({ imports: [FeatureModule] })
export class MidA {}
@NgModule({ imports: [FeatureModule] })
export class MidB {}
@Component({ selector: "prov-root", template: "<span>{{ $ctrl.seen }}</span>" })
export class Root {
  seen: string;
  constructor(@Inject(API_URL) apiUrl: string, @Inject("provFromFactory") fromFactory: string, @Inject("provAlias") alias: Base, @Inject(MULTI) multi: string[], _c: Counter) {
    this.seen = [apiUrl, fromFactory, alias.tag, multi.join("+")].join("|");
  }
}
@NgModule({
  imports: [MidA, MidB],
  declarations: [Root],
  bootstrap: [Root],
  providers: [
    Base,
    { provide: API_URL, useValue: "https://x.test" },
    { provide: "provFromFactory", useFactory: (url: string) => "f(" + url + ")", deps: [API_URL] },
    { provide: "provAlias", useExisting: Base },
    { provide: MULTI, useValue: "a", multi: true },
    { provide: MULTI, useValue: "b", multi: true },
  ],
})
export class AppModule {}
(globalThis as any).Counter = Counter;`.replace(`import { Component`, `import { Inject, Component`),
      );
      expect(text("prov-root span")).toBe("https://x.test|f(https://x.test)|base|a+b");
      expect(app!.global<{ instances: number }>("Counter").instances).toBe(1);
    });
  });

  it("@Directive y @Pipe declarados en un @NgModule anidado corren en el template del que lo importa", async () => {
    await boot(
      `@Directive({ selector: "[appUpper]" })
export class UpperDirective { constructor(el: ElementRef<HTMLElement>) { el.nativeElement.setAttribute("data-upper", ""); } }
@Pipe({ name: "shout" })
export class ShoutPipe { transform(v: string): string { return v.toUpperCase() + "!"; } }
@NgModule({ declarations: [UpperDirective, ShoutPipe] })
export class SharedModule {}
@Component({ selector: "decl-root", template: "<p app-upper>{{ 'hola' | shout }}</p>" })
export class Root {}
@NgModule({ imports: [SharedModule], declarations: [Root], bootstrap: [Root] })
export class AppModule {}`,
    );
    expect(text("decl-root p")).toBe("HOLA!");
    expect(app!.document.querySelector("decl-root p")?.hasAttribute("data-upper")).toBe(true);
  });

  it("@Output(EventEmitter): x.emit(v) dispara la expresión del padre con $event = v; this.x sigue siendo el emitter; sin expresión no explota", async () => {
    await boot(
      `@Component({ selector: "out-child", template: "x" })
export class Child { @Output() changed = new EventEmitter<number>(); }
@Component({ selector: "out-root", template: "<out-child id='a' changed='$ctrl.got.push($event)'></out-child><out-child id='b'></out-child>" })
export class Root { got: number[] = []; }
@NgModule({ declarations: [Root, Child], bootstrap: [Root] })
export class AppModule {}`,
    );
    const [a, b] = ["#a", "#b"].map((selector) => app!.angular.element(app!.document.querySelector(selector)!).controller("outChild") as { changed: { emit(v: number): void; subscribe: unknown } });
    a!.changed.emit(5);
    expect(typeof a!.changed.subscribe).toBe("function");
    expect(() => b!.changed.emit(1)).not.toThrow();
    expect(app!.controller<{ got: number[] }>("out-root", "outRoot").got).toEqual([5]);
  });

  describe("TestBed (ngjs-core/testing)", () => {
    const TESTBED = `import { inject as testingInject, TestBed } from "ngjs-core/testing";
@Injectable()
export class Greeter { greet(): string { return "real"; } }
export const TOKEN = new InjectionToken<string>("TOKEN");
@Component({ selector: "tb-widget", template: "<span>{{ $ctrl.msg }} {{ $ctrl.label }}</span>" })
export class Widget { @Input() label = ""; msg: string; constructor(g: Greeter) { this.msg = g.greet(); } }
@Component({ selector: "tb-card", template: "<header><ng-content></ng-content></header>" })
export class Card {}
@Component({ selector: "tb-host", template: "<tb-card>proyectado</tb-card>" })
export class Host {}
@Component({ selector: "tb-loose", template: "" })
export class Loose { name = "loose"; }
@NgModule({ declarations: [Widget, Card], providers: [Greeter] })
export class FeatureModule {}
@NgModule({})
export class AppModule {}
(globalThis as any).TestBed = TestBed;
(globalThis as any).types = { Greeter, TOKEN, Widget, Host, Loose, FeatureModule, CommonModule };
(globalThis as any).testingInject = testingInject;
(globalThis as any).injectIn = (token: unknown) => TestBed.runInInjectionContext(() => inject(token as any));
`;

    type TB = {
      configureTestingModule(def: object): TB;
      overrideProvider(token: unknown, provider: object): TB;
      overrideComponent(type: unknown, override: object): TB;
      overrideTemplate(type: unknown, template: string): TB;
      inject<T>(token: unknown, notFound?: unknown, options?: object): T;
      createComponent<T>(type: unknown): Fixture<T>;
      resetTestingModule(): TB;
    };
    type Fixture<T> = {
      componentInstance: T;
      nativeElement: HTMLElement;
      componentRef: { setInput(name: string, value: unknown): void };
      detectChanges(): void;
      autoDetectChanges(auto?: boolean): void;
      whenStable(): Promise<boolean>;
      destroy(): void;
    };
    type Types = Record<"Greeter" | "TOKEN" | "Widget" | "Host" | "Loose" | "FeatureModule" | "CommonModule", unknown>;

    async function testBed(): Promise<{ TestBed: TB; types: Types }> {
      await boot(TESTBED);
      return { TestBed: app!.global<TB>("TestBed"), types: app!.global<Types>("types") };
    }

    it("inject(): resuelve del módulo configurado; providers y overrideProvider ganan; notFoundValue/optional; injector perezoso", async () => {
      const { TestBed, types } = await testBed();
      TestBed.configureTestingModule({ imports: [types.FeatureModule] });
      expect(TestBed.inject<{ greet(): string }>(types.Greeter).greet()).toBe("real");
      expect(() => TestBed.configureTestingModule({})).toThrow(/ya se instanció/);
      expect(() => TestBed.overrideProvider(types.Greeter, { useValue: {} })).toThrow(/ya se instanció/);
      expect(TestBed.inject(types.TOKEN, "def")).toBe("def");
      expect(TestBed.inject(types.TOKEN, null, { optional: true })).toBeNull();
      expect(() => TestBed.inject(types.TOKEN)).toThrow();

      TestBed.resetTestingModule()
        .configureTestingModule({ imports: [types.FeatureModule], providers: [{ provide: types.TOKEN, useValue: "v" }] })
        .overrideProvider(types.Greeter, { useValue: { greet: () => "override" } });
      expect(TestBed.inject<{ greet(): string }>(types.Greeter).greet()).toBe("override");
      expect(TestBed.inject(types.TOKEN)).toBe("v");
      expect(app!.global<(token: unknown) => unknown>("injectIn")(types.TOKEN)).toBe("v");
    });

    it("createComponent(): ComponentFixture que renderiza con detectChanges(), setInput, autoDetectChanges y proyecta <ng-content>", async () => {
      const { TestBed, types } = await testBed();
      TestBed.configureTestingModule({
        imports: [types.CommonModule, types.FeatureModule],
        declarations: [types.Host],
        providers: [{ provide: types.Greeter, useValue: { greet: () => "fake" } }],
      });
      const fixture = TestBed.createComponent<{ msg: string }>(types.Widget);
      expect(fixture.componentInstance.msg).toBe("fake");
      expect(fixture.nativeElement.localName).toBe("tb-widget");
      expect(fixture.nativeElement.parentElement?.id).toBe("root0");
      expect(fixture.nativeElement.textContent).not.toContain("fake");

      fixture.detectChanges();
      expect(fixture.nativeElement.textContent?.trim()).toBe("fake");
      fixture.componentRef.setInput("label", "L");
      expect(fixture.nativeElement.textContent?.trim()).toBe("fake");
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent?.trim()).toBe("fake L");

      fixture.autoDetectChanges();
      fixture.componentRef.setInput("label", "M");
      TestBed.inject<{ $digest(): void }>("$rootScope").$digest();
      expect(fixture.nativeElement.textContent?.trim()).toBe("fake M");
      await expect(fixture.whenStable()).resolves.toBeTypeOf("boolean");

      const host = TestBed.createComponent(types.Host);
      host.detectChanges();
      expect(host.nativeElement.textContent?.trim()).toBe("proyectado");
      expect(host.nativeElement.parentElement?.id).toBe("root1");

      TestBed.resetTestingModule();
      expect(app!.document.querySelector("[ngjs-test-root]")).toBeNull();
      expect(fixture.nativeElement.isConnected).toBe(false);
    });

    it("overrideComponent()/overrideTemplate(): pisa el template de uno declarado y registra uno suelto (con <ng-content>)", async () => {
      const { TestBed, types } = await testBed();
      TestBed.configureTestingModule({ imports: [types.FeatureModule] })
        .overrideTemplate(types.Widget, "<b>{{ $ctrl.msg }}!</b>")
        .overrideComponent(types.Loose, { set: { template: "<tb-card>{{ $ctrl.name }}</tb-card><i><ng-content></ng-content></i>" } });

      const widget = TestBed.createComponent(types.Widget);
      widget.detectChanges();
      expect(widget.nativeElement.innerHTML).toContain("<b");
      expect(widget.nativeElement.textContent?.trim()).toBe("real!");

      const loose = TestBed.createComponent(types.Loose);
      loose.detectChanges();
      expect(loose.nativeElement.querySelector("tb-card header")?.textContent?.trim()).toBe("loose");

      TestBed.resetTestingModule();
      expect(() => TestBed.overrideComponent(types.Loose, { add: { template: "x" } })).toThrow(/solo se soporta/);
      expect(() => TestBed.overrideComponent(types.Greeter, { set: { template: "x" } })).toThrow(/no es un @Component/);
    });

    it("inject([...], fn) de testing: resuelve los tokens con TestBed.inject y conserva this", async () => {
      const { TestBed, types } = await testBed();
      TestBed.configureTestingModule({ imports: [types.FeatureModule], providers: [{ provide: types.TOKEN, useValue: "v" }] });
      const testingInject = app!.global<(tokens: unknown[], fn: Function) => () => unknown>("testingInject");
      const context = { seen: [] as unknown[] };
      testingInject([types.Greeter, types.TOKEN], function (this: typeof context, greeter: { greet(): string }, value: string) {
        this.seen.push(greeter.greet(), value);
      }).call(context);
      expect(context.seen).toEqual(["real", "v"]);
    });
  });
});
