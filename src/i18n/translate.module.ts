import angular from "angular";
import "angular-translate";
import "angular-aria";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { ɵgetRegisteredLocale } from "@/i18n/locale-data.ts";

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

/**
 * Lo imperativo de i18n: en cada cambio de idioma swapea `$locale` con lo registrado en `registerLocaleData`
 * (sin HTTP ni assets; un idioma no registrado no cambia nada).
 */
class LocaleSync {
  static readonly run = Object.assign(
    ($rootScope: angular.IRootScopeService, $locale: angular.ILocaleService, $translate: { use(): string }) => {
      const apply = () => {
        const active = $translate.use();
        const data = active ? ɵgetRegisteredLocale(active) : undefined;
        if (!data) return;
        angular.extend($locale, data);
        $locale.id = (data.id ?? active).toLowerCase();
      };
      apply();
      $rootScope.$on("$translateChangeSuccess", apply);
    },
    { $inject: ["$rootScope", "$locale", "$translate"] },
  );

  /** El `.config()` de `$translateProvider` con `config` — solo existe en la fase de config de AngularJS. */
  static configure(config: I18nConfig): angular.Injectable<(provider: TranslateProvider) => void> {
    return Object.assign(
      ($translateProvider: TranslateProvider) => {
        for (const [lang, table] of Object.entries(config.translations ?? {}))
          $translateProvider.translations(lang, table);
        $translateProvider.useSanitizeValueStrategy(config.sanitizeStrategy ?? "escape");
        if (config.defaultLanguage) $translateProvider.preferredLanguage(config.defaultLanguage);
        if (config.fallbackLanguage) $translateProvider.fallbackLanguage(config.fallbackLanguage);
      },
      { $inject: ["$translateProvider"] },
    );
  }
}

const I18nNativeModule = angular.module("ng.js.i18n", [TRANSLATE, ARIA]).run(LocaleSync.run);

let configured = 0;

/**
 * i18n sobre `angular-translate` (+ `ngAria`), con la forma de `@ngx-translate`: `imports: [TranslateModule]`
 * trae el filtro/directiva `translate` para los templates, `TranslateService` y el swap de `$locale`.
 * `TranslateModule.forRoot({ translations, defaultLanguage, ... })` además configura `$translateProvider`.
 */
@NgModule({ imports: [I18nNativeModule] })
export class TranslateModule {
  /**
   * Un `angular.module` con la config (cada llamada, uno nuevo: la config trae las tablas). `$translateProvider`
   * solo existe en la fase de config de AngularJS, así que no puede ir como provider.
   */
  static forRoot(config: I18nConfig = {}): angular.IModule {
    configured += 1;
    return angular.module(`ng.js.i18n.${configured}`, [I18nNativeModule.name]).config(LocaleSync.configure(config));
  }
}

/** Equivalente funcional de `TranslateModule.forRoot(...)` (para `imports`). */
export function provideI18n(config: I18nConfig = {}): angular.IModule {
  return TranslateModule.forRoot(config);
}
