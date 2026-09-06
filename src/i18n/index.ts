/**
 * `ngjs-core/i18n` — superficie de clase de internacionalización sobre
 * `angular-translate`. Ver `docs/ORDEN-DE-CONSTRUCCION.md` etapa 18.
 *
 * El filtro / la directiva `translate` (uso en template) los trae la lib; acá
 * solo van `TranslateService` (uso desde código), el token `LOCALE_ID` y
 * `registerLocaleData`. El `angular.module` que enciende todo vive en
 * `ngjs-core/runtime/i18n`. Los datos de locale, en `ngjs-core/i18n/locales/<id>`.
 */
export {
  type LocaleData,
  PLURAL_CATEGORY,
  registerLocaleData,
  ɵclearRegisteredLocales,
  ɵgetRegisteredLocale,
} from "@/i18n/locale-data.ts";
export { LOCALE_ID, TranslateService, TranslateServiceImpl } from "@/i18n/translate.ts";
