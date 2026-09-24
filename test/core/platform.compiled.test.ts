import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

describe("plataforma: servicios de la raíz y tokens por elemento (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("un componente recibe ElementRef/ChangeDetectorRef/DestroyRef (por instancia) y Injector/NgZone/ApplicationRef/DOCUMENT (de la raíz)", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { ApplicationRef, ChangeDetectorRef, Component, DestroyRef, ElementRef, Inject, Injector, NgModule, NgZone } from "ngjs-core";
import { DOCUMENT } from "ngjs-core/common";

@Component({ selector: "app-root", template: "<span>{{ $ctrl.label }}</span>" })
export class AppComponent {
  label = "hola";
  destroyed = false;
  constructor(
    readonly el: ElementRef<HTMLElement>,
    readonly cdr: ChangeDetectorRef,
    destroyRef: DestroyRef,
    readonly injector: Injector,
    readonly zone: NgZone,
    readonly appRef: ApplicationRef,
    @Inject(DOCUMENT) readonly doc: Document,
  ) {
    destroyRef.onDestroy(() => (this.destroyed = true));
  }
}

@NgModule({ declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );

    const root = app.controller<{
      label: string;
      destroyed: boolean;
      el: { nativeElement: Element };
      cdr: { detectChanges(): void };
      injector: { get(token: unknown): unknown };
      zone: { run<T>(fn: () => T): T };
      appRef: { tick(): void };
      doc: Document;
    }>("app-root", "appRoot");

    expect(root.el.nativeElement).toBe(app.document.querySelector("app-root"));
    expect(root.doc).toBe(app.document);
    expect(root.zone.run(() => 42)).toBe(42);
    expect(root.injector.get("$rootScope")).toBe(app.get("$rootScope"));

    root.label = "chau";
    root.cdr.detectChanges();
    expect(app.document.querySelector("app-root span")?.textContent).toBe("chau");

    app.get<{ $destroy(): void }>("$rootScope").$destroy();
    expect(root.destroyed).toBe(true);
  });

  it("ErrorHandler recibe lo que atrapa $exceptionHandler, y un @NgModule lo reemplaza con su provider", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, ErrorHandler, Injectable, NgModule } from "ngjs-core";

@Injectable()
export class CollectingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void { this.errors.push(error); }
}

@Component({ selector: "app-root", template: "" })
export class AppComponent {}

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [{ provide: ErrorHandler, useClass: CollectingErrorHandler }],
})
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );

    const $exceptionHandler = app.get<(error: Error) => void>("$exceptionHandler");
    $exceptionHandler(new Error("boom"));

    const handler = app.injector.get<{ errors: Error[] }>(
      (app.window as unknown as { ɵngjsRootProviders: [string, unknown][] }).ɵngjsRootProviders.find(([name]) =>
        name.startsWith("ErrorHandler_"),
      )![0],
    );
    expect(handler.errors.map((error) => error.message)).toEqual(["boom"]);
  });

  it("APP_INITIALIZER (multi): bootstrapModule() espera sus promesas", async () => {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { APP_INITIALIZER, Component, NgModule } from "ngjs-core";

export const log: string[] = [];
(globalThis as any).initLog = log;

@Component({ selector: "app-root", template: "" })
export class AppComponent {}

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [
    { provide: APP_INITIALIZER, multi: true, useFactory: () => () => new Promise<void>((resolve) => setTimeout(() => { log.push("async"); resolve(); }, 5)) },
    { provide: APP_INITIALIZER, multi: true, useFactory: () => () => { log.push("sync"); } },
  ],
})
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );

    // `bootstrap()` espera a `bootstrapModule()`, que espera a los initializers.
    expect((app.window as unknown as { initLog: string[] }).initLog.sort()).toEqual(["async", "sync"]);
  });

  describe("porta de old/test/platform/{bootstrap,injector-wiring,digest-bridge}", () => {
    const MAIN = `import { platformBrowserDynamic } from "ngjs-core";
import { AppModule } from "./app.module";
const platform = platformBrowserDynamic();
(globalThis as any).platform = platform;
(globalThis as any).ɵready = platform.bootstrapModule(AppModule);
`;
    async function boot(module: string): Promise<CompiledApp> {
      app = await CompiledApp.bootstrap(
        {
          "app.module.ts": `import { ApplicationRef, Component, ErrorHandler, Injectable, InjectionToken, Injector, NgModule, NgZone, inject, provideAppInitializer } from "ngjs-core";
${module}`,
          "main.ts": MAIN,
        },
        "<app-root></app-root>",
      );
      return app;
    }
    const plain = `@Component({ selector: "app-root", template: "hola {{ $ctrl.name }}" })
export class AppComponent { name = "mundo"; }
@NgModule({ declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}`;

    it("arranca, compila el componente raíz, whenStable() resuelve; destroy() de la plataforma destruye la app y notifica", async () => {
      await boot(plain);
      expect(app!.document.querySelector("app-root")?.textContent?.trim()).toBe("hola mundo");
      const appRef = app!.inject<{ whenStable(): Promise<void>; destroyed: boolean }>("ApplicationRef");
      await expect(appRef.whenStable()).resolves.toBeUndefined();

      const platform = app!.global<{ onDestroy(fn: () => void): void; destroy(): void; destroyed: boolean; bootstrapModule(m: unknown): Promise<unknown> }>("platform");
      let notified = false;
      platform.onDestroy(() => {
        notified = true;
      });
      platform.destroy();
      expect(platform.destroyed).toBe(true);
      expect(appRef.destroyed).toBe(true);
      expect(notified).toBe(true);
      await expect(platform.bootstrapModule({})).rejects.toThrow("PlatformRef ya fue destruido");
    });

    it("provideAppInitializer() async: bootstrapModule() lo espera", async () => {
      await boot(`const order: string[] = [];
(globalThis as any).order = order;
provideAppInitializer(async () => { order.push("initializer-start"); await Promise.resolve(); await Promise.resolve(); order.push("initializer-end"); });
(globalThis as any).ɵreadyMarker = true;
${plain}`);
      expect(app!.global<string[]>("order")).toEqual(["initializer-start", "initializer-end"]);
    });


    it("ErrorHandler recibe lo que se tira dentro de ngZone.runGuarded()", async () => {
      await boot(`@Injectable()
export class CollectingErrorHandler extends ErrorHandler { errors: unknown[] = []; handleError(error: unknown): void { this.errors.push(error); } }
@Component({ selector: "app-root", template: "" })
export class AppComponent {}
@NgModule({ declarations: [AppComponent], bootstrap: [AppComponent], providers: [{ provide: ErrorHandler, useClass: CollectingErrorHandler }] })
export class AppModule {}`);
      const zone = app!.inject<{ runGuarded(fn: () => void): unknown }>("NgZone");
      const boom = new app!.window.Error("boom de zona");
      expect(zone.runGuarded(() => {
        throw boom;
      })).toBeUndefined();
      expect(app!.inject<{ errors: unknown[] }>("ErrorHandler").errors).toEqual([boom]);
    });

    it("Injector desde el $injector de la app; inject() de runtime después del bootstrap", async () => {
      await boot(`export const API_URL = new InjectionToken<string>("API_URL");
@Component({ selector: "app-root", template: "" })
export class AppComponent {}
@NgModule({ declarations: [AppComponent], bootstrap: [AppComponent], providers: [{ provide: API_URL, useValue: "https://example.test" }] })
export class AppModule {}
(globalThis as any).fixture = { inject, API_URL };`);
      const injector = app!.inject<{ get(token: string): unknown }>("Injector");
      expect(injector.get("$rootScope")).toBe(app!.get("$rootScope"));
      const { inject, API_URL } = app!.global<{ inject(token: unknown): unknown; API_URL: unknown }>("fixture");
      expect(inject("$rootScope")).toBe(app!.get("$rootScope"));
      expect(inject(API_URL)).toBe("https://example.test");
    });

    it("zona → digest: un .then() nativo actualiza la vista solo; lo programado en runOutsideAngular no", async () => {
      await boot(`@Component({ selector: "app-root", template: "{{ $ctrl.n }}" })
export class AppComponent {
  n = 0;
  constructor(private zone: NgZone) {}
  inside(): void { Promise.resolve().then(() => this.n++); }
  outside(): void { this.zone.runOutsideAngular(() => setTimeout(() => this.n++, 0)); }
}
@NgModule({ declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}`);
      const root = app!.controller<{ n: number; inside(): void; outside(): void }>("app-root", "appRoot");
      const text = () => app!.document.querySelector("app-root")?.textContent?.trim();
      const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

      root.inside();
      await tick();
      expect(text()).toBe("1");

      root.outside();
      await tick();
      expect(root.n).toBe(2);
      expect(text()).toBe("1"); // sin digest: la vista no se enteró
    });
  });
});
