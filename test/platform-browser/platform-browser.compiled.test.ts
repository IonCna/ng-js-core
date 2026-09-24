import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

/**
 * Lo que proveen `BrowserModule`/`CommonModule` por DI (la lógica de cada servicio la cubren sus tests unitarios).
 * Porta de `old/test/platform-browser/*` (el `boot()` por módulo de AngularJS y `document-token.test.ts`).
 */
describe("etapa 14 — platform-browser: provisión por BrowserModule (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  const appModule = (providers = "") => `
import { Component, NgModule } from "ngjs-core";
import { BrowserModule } from "ngjs-core/platform-browser";
import { APP_BASE_HREF, PathLocationStrategy, LocationStrategy } from "ngjs-core/common";

@Component({ selector: "app-root", template: "" })
export class AppComponent {}

@NgModule({ imports: [BrowserModule], declarations: [AppComponent], bootstrap: [AppComponent], providers: [${providers}] })
export class AppModule {}
`;

  it("Title, Meta, DomSanitizer, RendererFactory2 (BrowserModule), ViewportScroller y PlatformLocation (CommonModule), DOCUMENT", async () => {
    app = await CompiledApp.bootstrap({ "app.module.ts": appModule() }, "<app-root></app-root>");

    app.inject<{ setTitle(title: string): void }>("Title").setTitle("desde DI");
    expect(app.document.title).toBe("desde DI");
    expect(app.inject<{ addTag(tag: object): Element | null }>("Meta").addTag({ name: "x", content: "y" })?.tagName).toBe("META");
    expect(app.inject<{ sanitize(context: number, value: string): string }>("DomSanitizer").sanitize(1, "<b onclick='x()'>b</b>")).toBe("<b>b</b>");
    const renderer = app.inject<{ createRenderer(host: unknown, type: unknown): { createElement(name: string): Element } }>("RendererFactory2").createRenderer(null, null);
    expect(renderer.createElement("section").tagName).toBe("SECTION");
    expect(typeof app.inject<{ getScrollPosition(): unknown }>("ViewportScroller").getScrollPosition).toBe("function");
    expect(app.inject<{ pathname: string }>("PlatformLocation").pathname).toBe(app.window.location.pathname);
    expect(app.inject<Document>("DOCUMENT")).toBe(app.document);
  });

  it("CommonModule no provee LocationStrategy (lo elige el router); APP_BASE_HREF se puede pisar por DI", async () => {
    app = await CompiledApp.bootstrap({ "app.module.ts": appModule() }, "<app-root></app-root>");
    expect(app.injector.has(CompiledApp.tokenName("LocationStrategy"))).toBe(false);
    expect(app.inject<string>("APP_BASE_HREF")).toBe("/");
    await app.destroy();

    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": appModule(
          `{ provide: APP_BASE_HREF, useValue: "/app" }, { provide: LocationStrategy, useClass: PathLocationStrategy }`,
        ),
      },
      "<app-root></app-root>",
    );
    const strategy = app.inject<{ getBaseHref(): string; prepareExternalUrl(url: string): string }>("LocationStrategy");
    expect(strategy.getBaseHref()).toBe("/app");
    expect(strategy.prepareExternalUrl("/x")).toBe("/app/x");
  });
});
