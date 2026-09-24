/**
 * `ngjs-core/i18n` — i18n sobre `angular-translate`: `TranslateModule` (templates: filtro/directiva `translate`),
 * `TranslateService` (desde código), `LOCALE_ID` y `registerLocaleData`. Los datos de locale, en
 * `ngjs-core/i18n/locales/<id>`.
 */
export {
  type LocaleData,
  PLURAL_CATEGORY,
  registerLocaleData,
  ɵclearRegisteredLocales,
  ɵgetRegisteredLocale,
} from "@/i18n/locale-data.ts";
export { type I18nConfig, provideI18n, TranslateModule } from "@/i18n/translate.module.ts";
export { LOCALE_ID, TranslateService, TranslateServiceImpl } from "@/i18n/translate.ts";
