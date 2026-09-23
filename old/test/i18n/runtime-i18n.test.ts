import angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { LOCALE_ID, TranslateService } from "@/i18n/index.ts";
import esMX from "@/i18n/locales/es-MX.ts";
import {
  i18nModule,
  provideI18n,
  registerLocaleData,
  TranslateModule,
  ɵclearRegisteredLocales,
} from "@/runtime/i18n/index.ts";

interface Translate {
  instant(key: string): string;
  use(): string;
  use(lang: string): PromiseLike<string>;
}

function boot(mod: angular.IModule, html = `<p>{{ 'HELLO' | translate }}</p>`) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [mod.name], { strictDi: false });
  return { host, injector, $rootScope: injector.get<angular.IRootScopeService>("$rootScope") };
}

const TABLES = {
  en: { HELLO: "Hello" },
  "es-mx": { HELLO: "Hola" },
};

afterEach(() => ɵclearRegisteredLocales());

describe("etapa 18 — ngjs-core/runtime/i18n", () => {
  it("carga pascalprecht.translate + ngAria, y nada más", () => {
    expect(provideI18n().requires).toEqual(["ng.js.core", "pascalprecht.translate", "ngAria"]);
  });

  it("el filtro `translate` renderiza en el template", () => {
    const { host, $rootScope } = boot(TranslateModule.forRoot({ translations: TABLES, defaultLanguage: "en" }));
    $rootScope.$digest();
    expect(host.querySelector("p")?.textContent?.trim()).toBe("Hello");
  });

  it("TranslateService cambia el idioma en runtime (criterio de cierre)", async () => {
    const { injector, $rootScope } = boot(provideI18n({ translations: TABLES, defaultLanguage: "en" }));
    const $translate = injector.get<Translate>("$translate");
    const translate = injector.get<TranslateService>(TranslateService.$name);

    $rootScope.$digest();
    expect($translate.instant("HELLO")).toBe("Hello");

    const switched = translate.use("es-mx");
    for (let i = 0; i < 3; i++) $rootScope.$apply();
    await switched;

    expect($translate.instant("HELLO")).toBe("Hola");
    expect(translate.currentLang).toBe("es-mx");
  });

  it("LOCALE_ID resuelve al idioma activo", () => {
    const { injector, $rootScope } = boot(provideI18n({ translations: TABLES, defaultLanguage: "en" }));
    $rootScope.$digest();
    expect(injector.get<string>(LOCALE_ID.toString())).toBe("en");
  });

  it("registerLocaleData → $locale se swapea al cambiar de idioma", async () => {
    registerLocaleData(esMX);
    const { injector, $rootScope } = boot(provideI18n({ translations: TABLES, defaultLanguage: "en" }));
    const $translate = injector.get<Translate>("$translate");
    const $locale = injector.get<angular.ILocaleService>("$locale");

    $rootScope.$digest();
    expect($locale.NUMBER_FORMATS.CURRENCY_SYM).not.toBe("$MX"); // arranca en el default de AngularJS

    const switched = $translate.use("es-mx");
    for (let i = 0; i < 3; i++) $rootScope.$apply();
    await switched;

    expect($locale.id).toBe("es-mx");
    expect($locale.DATETIME_FORMATS.MONTH[0]).toBe("enero");
    expect($locale.NUMBER_FORMATS.DECIMAL_SEP).toBe(".");
    expect($locale.NUMBER_FORMATS.GROUP_SEP).toBe(",");
  });

  it("sin registerLocaleData, $locale no se toca (y no hay ningún GET)", async () => {
    const { injector, $rootScope } = boot(provideI18n({ translations: TABLES, defaultLanguage: "en" }));
    const $translate = injector.get<Translate>("$translate");
    const $locale = injector.get<angular.ILocaleService>("$locale");
    const before = $locale.id;

    const switched = $translate.use("es-mx");
    for (let i = 0; i < 3; i++) $rootScope.$apply();
    await switched;

    expect($locale.id).toBe(before);
  });

  it("no depende de tmh.dynamicLocale", () => {
    expect(i18nModule().requires).not.toContain("tmh.dynamicLocale");
  });
});
