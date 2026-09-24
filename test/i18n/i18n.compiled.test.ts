import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";

interface Translate {
  instant(key: string): string;
  use(): string;
  use(lang: string): PromiseLike<string>;
}

/** Porta de `old/test/i18n/runtime-i18n.test.ts`: `TranslateModule` es un `@NgModule` compilado. */
describe("etapa 18 — TranslateModule (código compilado)", () => {
  let app: CompiledApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  async function boot(options: { registerEsMx?: boolean; forRoot?: boolean } = {}): Promise<CompiledApp> {
    app = await CompiledApp.bootstrap(
      {
        "app.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { registerLocaleData, TranslateModule } from "ngjs-core/i18n";
import esMX from "ngjs-core/i18n/locales/es-MX";

${options.registerEsMx ? "registerLocaleData(esMX);" : ""}
const TABLES = { en: { HELLO: "Hello" }, "es-mx": { HELLO: "Hola" } };

@Component({ selector: "app-root", template: "<p>{{ 'HELLO' | translate }}</p>" })
export class AppComponent {}

@NgModule({
  imports: [${options.forRoot === false ? "TranslateModule" : 'TranslateModule.forRoot({ translations: TABLES, defaultLanguage: "en" })'}],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
`,
      },
      "<app-root></app-root>",
    );
    app.digest();
    return app;
  }

  async function switchTo(lang: string): Promise<void> {
    const switched = app!.inject<{ use(lang: string): Promise<string> }>("TranslateService").use(lang);
    for (let i = 0; i < 3; i++) app!.get<{ $apply(): void }>("$rootScope").$apply();
    await switched;
  }

  it("carga pascalprecht.translate + ngAria; el filtro translate renderiza en el template", async () => {
    await boot();
    expect(Object.keys((app!.injector as unknown as { modules: object }).modules)).toEqual(
      expect.arrayContaining(["pascalprecht.translate", "ngAria"]),
    );
    expect(app!.document.querySelector("app-root p")?.textContent?.trim()).toBe("Hello");
  });

  it("TranslateService cambia el idioma en runtime (criterio de cierre)", async () => {
    await boot();
    const $translate = app!.get<Translate>("$translate");
    expect($translate.instant("HELLO")).toBe("Hello");

    await switchTo("es-mx");

    expect($translate.instant("HELLO")).toBe("Hola");
    expect(app!.inject<{ currentLang: string }>("TranslateService").currentLang).toBe("es-mx");
  });

  it("LOCALE_ID resuelve al idioma activo", async () => {
    await boot();
    expect(app!.inject<string>("LOCALE_ID")).toBe("en");
  });

  it("registerLocaleData → $locale se swapea al cambiar de idioma", async () => {
    await boot({ registerEsMx: true });
    const $locale = app!.get<{ id: string; NUMBER_FORMATS: Record<string, string>; DATETIME_FORMATS: { MONTH: string[] } }>("$locale");
    expect($locale.NUMBER_FORMATS.CURRENCY_SYM).not.toBe("$MX");

    await switchTo("es-mx");

    expect($locale.id).toBe("es-mx");
    expect($locale.DATETIME_FORMATS.MONTH[0]).toBe("enero");
    expect($locale.NUMBER_FORMATS.DECIMAL_SEP).toBe(".");
    expect($locale.NUMBER_FORMATS.GROUP_SEP).toBe(",");
  });

  it("sin registerLocaleData, $locale no se toca", async () => {
    await boot();
    const $locale = app!.get<{ id: string }>("$locale");
    const before = $locale.id;
    await switchTo("es-mx");
    expect($locale.id).toBe(before);
  });

  it("TranslateModule sin forRoot también sirve (sin tablas) y no depende de tmh.dynamicLocale", async () => {
    await boot({ forRoot: false });
    const modules = Object.keys((app!.injector as unknown as { modules: object }).modules);
    expect(modules).toContain("pascalprecht.translate");
    expect(modules).not.toContain("tmh.dynamicLocale");
  });
});
