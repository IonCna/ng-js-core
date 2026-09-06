/**
 * `ngjs-core/runtime/i18n` — el `angular.module` que enciende i18n + a11y en el
 * modo sin build step: carga `pascalprecht.translate` (`angular-translate`) y
 * `ngAria` (`angular-aria`), bindea `TranslateService` y `LOCALE_ID`, y en cada
 * cambio de idioma swapea `$locale` con lo que se haya pasado a
 * `registerLocaleData` (sin HTTP ni assets).
 *
 * Equivale a `TranslateModule.forRoot(...)` de `@ngx-translate`. **Opt-in** — no
 * se carga solo. La extracción de `i18n="…"` a un catálogo es del CLI.
 */
import angular from "angular";
import "angular-translate";
import "angular-aria";
import { ɵgetRegisteredLocale } from "@/i18n/locale-data.ts";
import { LOCALE_ID, TranslateService, TranslateServiceImpl } from "@/i18n/translate.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

export {
  type LocaleData,
  registerLocaleData,
  ɵclearRegisteredLocales,
  ɵgetRegisteredLocale,
} from "@/i18n/locale-data.ts";
export { LOCALE_ID, TranslateService, TranslateServiceImpl } from "@/i18n/translate.ts";

const TRANSLATE = "pascalprecht.translate";
const ARIA = "ngAria";

export interface I18nConfig {
  /** Tablas por idioma — `{ en: { KEY: "text" }, es: { KEY: "texto" } }`. */
  translations?: Record<string, Record<string, unknown>>;
  /** Idioma inicial (`$translateProvider.preferredLanguage`). */
  defaultLanguage?: string;
  /** Fallback cuando falta una clave en el idioma activo. */
  fallbackLanguage?: string | string[];
  /** `"escape"` (default) · `"sanitize"` (necesita `ngSanitize`) · `"escapeParameters"` · `null`. */
  sanitizeStrategy?: "escape" | "sanitize" | "escapeParameters" | null;
}

interface TranslateProvider {
  translations(langKey: string, table: Record<string, unknown>): TranslateProvider;
  preferredLanguage(langKey: string): TranslateProvider;
  fallbackLanguage(langKey: string | string[]): TranslateProvider;
  useSanitizeValueStrategy(strategy: string | null): TranslateProvider;
}

let moduleSeq = 0;

/**
 * `angular.module("ngjs.i18n.N", ["ng.js.core", "pascalprecht.translate", "ngAria"])`.
 * Cada llamada arma un módulo nuevo (como `RouterModule.forRoot`), así se puede
 * pasar más de una config. Memoizar no aplica: la config trae las `translations`.
 */
export function i18nModule(config: I18nConfig = {}): angular.IModule {
  installCoreModule();
  moduleSeq += 1;

  const mod = angular.module(`ngjs.i18n.${moduleSeq}`, ["ng.js.core", TRANSLATE, ARIA]);

  const configure = ($translateProvider: TranslateProvider) => {
    for (const [lang, table] of Object.entries(config.translations ?? {})) {
      $translateProvider.translations(lang, table);
    }
    $translateProvider.useSanitizeValueStrategy(config.sanitizeStrategy ?? "escape");
    if (config.defaultLanguage) $translateProvider.preferredLanguage(config.defaultLanguage);
    if (config.fallbackLanguage) $translateProvider.fallbackLanguage(config.fallbackLanguage);
  };
  configure.$inject = ["$translateProvider"];
  mod.config(configure);

  mod.service(TranslateService.$name, TranslateServiceImpl);

  // `LOCALE_ID` = idioma activo al momento de inyectarse (estático, como en Angular real).
  const localeIdFactory = ($translate: { use(): string }) => $translate.use();
  localeIdFactory.$inject = ["$translate"];
  mod.factory(LOCALE_ID.toString(), localeIdFactory);

  // Swap de `$locale` en cada cambio de idioma, con lo registrado en `registerLocaleData`.
  // Si el idioma no está registrado, no hace nada (y no hay ningún GET).
  const syncLocale = (
    $rootScope: angular.IRootScopeService,
    $locale: angular.ILocaleService,
    $translate: { use(): string },
  ) => {
    const apply = () => {
      const active = $translate.use();
      if (!active) return;
      const data = ɵgetRegisteredLocale(active);
      if (!data) return;
      angular.extend($locale, data);
      $locale.id = (data.id ?? active).toLowerCase();
    };
    apply();
    $rootScope.$on("$translateChangeSuccess", apply);
  };
  syncLocale.$inject = ["$rootScope", "$locale", "$translate"];
  mod.run(syncLocale);

  return mod;
}

/** Estilo `@ngx-translate` — devuelve el `angular.IModule` para `@NgModule({ imports: [...] })`. */
export const TranslateModule = {
  forRoot(config: I18nConfig = {}): angular.IModule {
    return i18nModule(config);
  },
};

/** Equivalente funcional de `TranslateModule.forRoot(...)`. */
export function provideI18n(config: I18nConfig = {}): angular.IModule {
  return i18nModule(config);
}
