import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Porta de `old/test/cdk/a11y/runtime-a11y.test.ts` (y la provisión de `cdk/layout`): los servicios se proveen solos
 * en la raíz y las directivas vienen en `A11yModule` (la lógica de cada servicio la cubren sus tests unitarios).
 */
describe("etapa 18 (a11y) / 14 (layout) — CDK (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(template: string, imports = "A11yModule"): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { A11yModule } from "ngjs-core/cdk/a11y";
import { LayoutModule } from "ngjs-core/cdk/layout";

@Component({ selector: "app-root", template: ${JSON.stringify(template)} })
export class AppComponent {
  msg = "";
  origins: unknown[] = [];
  onFocus(origin: unknown): void { this.origins.push(origin); }
}

@NgModule({ imports: [${imports}], declarations: [AppComponent], bootstrap: [AppComponent] })
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    return app;
  }

  it("LiveAnnouncer, InteractivityChecker, FocusTrapFactory, FocusMonitor, MediaMatcher y BreakpointObserver se proveen solos en la raíz", async () => {
    await boot("", "A11yModule, LayoutModule");
    for (const service of ["LiveAnnouncer", "InteractivityChecker", "FocusTrapFactory", "FocusMonitor", "MediaMatcher", "BreakpointObserver"]) {
      expect(app!.inject(service), service).toBeDefined();
    }
  });

  it("[cdkTrapFocus] crea el trap con anclas contra su host", async () => {
    await boot("<div cdk-trap-focus><button>a</button><button>b</button></div>");
    await flush();
    const trapped = app!.document.querySelector("[cdk-trap-focus]")!;
    expect(trapped.previousElementSibling?.classList.contains("cdk-focus-trap-anchor")).toBe(true);
    expect(trapped.nextElementSibling?.classList.contains("cdk-focus-trap-anchor")).toBe(true);
  });

  it("[cdkAriaLive] anuncia cuando cambia el texto del host", async () => {
    await boot("<div cdk-aria-live>{{ $ctrl.msg }}</div>");
    const root = app!.controller<{ msg: string }>("app-root", "appRoot");
    root.msg = "3 resultados";
    app!.digest();
    await flush(150); // el MutationObserver + el delay interno de LiveAnnouncer

    expect(app!.document.querySelector(".cdk-live-announcer-element")?.textContent).toBe("3 resultados");
  });

  it("[cdkMonitorElementFocus] emite cdkFocusChange con el origen ($event)", async () => {
    await boot('<button cdk-monitor-element-focus cdk-focus-change="$ctrl.onFocus($event)">x</button>');
    app!.document.querySelector("button")!.focus();
    await flush();
    app!.digest();

    expect(app!.controller<{ origins: unknown[] }>("app-root", "appRoot").origins).toContain("program");
  });

  it("A11yModule.forRoot({ liveAnnouncer }) fija los defaults de LiveAnnouncer", async () => {
    await boot("", 'A11yModule.forRoot({ liveAnnouncer: { politeness: "assertive" } })');
    await app!.inject<{ announce(message: string): Promise<void> }>("LiveAnnouncer").announce("hola");
    expect(app!.document.querySelector(".cdk-live-announcer-element")?.getAttribute("aria-live")).toBe("assertive");
  });
});
