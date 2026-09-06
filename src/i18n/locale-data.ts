/**
 * `registerLocaleData` — mismo nombre y firma que `@angular/core`, pero acá
 * `data` es el objeto `$locale` de AngularJS (lo que exporta
 * `ngjs-core/i18n/locales/<id>`), no el formato de `@angular/common/locales`.
 * El CLI reescribe el import al migrar.
 *
 * Se llama antes del bootstrap (como en Angular). El módulo `ngjs-core/runtime/i18n`
 * tiene un `.run` que, en cada cambio de idioma, busca acá el locale y hace
 * `angular.extend($locale, data)` — sin HTTP ni archivos de assets.
 */

export const PLURAL_CATEGORY = {
  ZERO: "zero",
  ONE: "one",
  TWO: "two",
  FEW: "few",
  MANY: "many",
  OTHER: "other",
} as const;

/** Subconjunto relevante de `$locale`. `pluralCat` es función → estos módulos son `.ts`, no JSON. */
export interface LocaleData {
  id?: string;
  localeID?: string;
  DATETIME_FORMATS?: Record<string, unknown>;
  NUMBER_FORMATS?: Record<string, unknown>;
  pluralCat?: (n: number, precision?: number) => string;
  [key: string]: unknown;
}

/** Registro global `id → LocaleData`. Estático por proceso, como `$locale` mismo. */
class LocaleRegistry {
  private static readonly entries = new Map<string, LocaleData>();

  static set(id: string, data: LocaleData): void {
    LocaleRegistry.entries.set(LocaleRegistry.normalize(id), data);
  }

  /** Match exacto, con fallback al idioma base (`es-mx` → `es`). */
  static get(id: string): LocaleData | undefined {
    const norm = LocaleRegistry.normalize(id);
    return LocaleRegistry.entries.get(norm) ?? LocaleRegistry.entries.get(norm.split("-")[0]);
  }

  static clear(): void {
    LocaleRegistry.entries.clear();
  }

  private static normalize(id: string): string {
    return id.toLowerCase().replace(/_/g, "-");
  }
}

/**
 * Registra los datos de un locale para fechas / números / moneda / plurales.
 * Overloads como Angular: el 2º arg string es `localeId`; si es objeto, es
 * `extraData`.
 */
export function registerLocaleData(data: LocaleData, localeId?: string, extraData?: Record<string, unknown>): void;
export function registerLocaleData(data: LocaleData, extraData: Record<string, unknown>): void;
export function registerLocaleData(
  data: LocaleData,
  localeId?: string | Record<string, unknown>,
  extraData?: Record<string, unknown>,
): void {
  let id: string | undefined;
  let extra: Record<string, unknown> | undefined;

  if (typeof localeId === "string") {
    id = localeId;
    extra = extraData;
  } else if (localeId) {
    extra = localeId;
  }

  id ??= data.id ?? data.localeID;
  if (!id) {
    throw new Error("registerLocaleData: falta el localeId (ni como argumento ni en `data.id`)");
  }

  LocaleRegistry.set(id, extra ? { ...data, ...extra } : data);
}

/** Interno — lo usa el `.run` del módulo i18n. */
export function ɵgetRegisteredLocale(localeId: string): LocaleData | undefined {
  return LocaleRegistry.get(localeId);
}

/** Interno — reset entre tests. */
export function ɵclearRegisteredLocales(): void {
  LocaleRegistry.clear();
}
