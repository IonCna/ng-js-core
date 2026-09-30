import type angular from "angular";
import { inject } from "@/core/di/inject.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * `LOCALE_ID` — mismo token que `@angular/core`: el idioma activo al inyectarse (`$translate.use()` si
 * `TranslateModule` está cargado; si no, `$locale.id`, como el `"en-US"` por defecto de Angular). El swap de
 * `$locale` (fechas / números / moneda) al cambiar de idioma lo hace `TranslateModule` con lo que se haya pasado a
 * `registerLocaleData` — ver `@/i18n/locale-data.ts`.
 */
export const LOCALE_ID = new InjectionToken<string>("LOCALE_ID", {
  factory: () => {
    const $injector = inject<angular.auto.IInjectorService>("$injector");
    const active = $injector.has("$translate") ? $injector.get<{ use(): string }>("$translate").use() : undefined;
    return active || $injector.get<angular.ILocaleService>("$locale").id;
  },
});
