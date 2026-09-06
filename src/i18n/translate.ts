import type angular from "angular";
import { Observable, Subject } from "rxjs";
import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * Superficie de clase de i18n — el shim imperativo sobre el servicio `$translate`
 * de `pascalprecht.translate` (`angular-translate`). Es el equivalente de
 * `$localize` imperativo de Angular, con la forma reconocible de `@ngx-translate`.
 *
 * El template NO usa esto: ahí van el filtro / la directiva `translate` que ya
 * trae la lib (ver `docs/ORDEN-DE-CONSTRUCCION.md` etapa 18). La extracción de
 * `i18n="…"` a un catálogo es del CLI.
 */

/** Subconjunto de `$translate` (`pascalprecht.translate`) que usa el shim — la lib no publica tipos. */
interface NgTranslateService {
  (translationId: string, interpolateParams?: Record<string, unknown>): PromiseLike<string>;
  instant(translationId: string, interpolateParams?: Record<string, unknown>): string;
  use(): string;
  use(langKey: string): PromiseLike<string>;
}

/** Payload de `$translateChangeSuccess` en `$rootScope`. */
interface TranslateChangeEvent {
  language: string;
}

export abstract class TranslateService {
  static readonly $name = "TranslateService";

  /** Idioma activo (`$translate.use()`). */
  abstract get currentLang(): string;

  /** Async — `$translate(key, params)` envuelto en Observable; completa tras la primera emisión. */
  abstract get(key: string, params?: Record<string, unknown>): Observable<string>;

  /** Sync — `$translate.instant(key, params)`. */
  abstract instant(key: string, params?: Record<string, unknown>): string;

  /** Como `get`, pero re-emite en cada cambio de idioma (no completa). */
  abstract stream(key: string, params?: Record<string, unknown>): Observable<string>;

  /** Cambia el idioma (`$translate.use(lang)`); resuelve cuando terminó de cargar. */
  abstract use(lang: string): Promise<string>;

  /** Emite `{ lang }` en cada `$translateChangeSuccess`. */
  abstract readonly onLangChange: Observable<{ lang: string }>;
}

export class TranslateServiceImpl extends TranslateService {
  static readonly $inject = ["$translate", "$rootScope"] as const;

  private readonly langChange$ = new Subject<{ lang: string }>();

  constructor(
    private readonly $translate: NgTranslateService,
    $rootScope: angular.IRootScopeService,
  ) {
    super();
    const offChange = $rootScope.$on("$translateChangeSuccess", (_event, data: TranslateChangeEvent) => {
      this.langChange$.next({ lang: data.language });
    });
    $rootScope.$on("$destroy", () => {
      offChange();
      this.langChange$.complete();
    });
  }

  get currentLang(): string {
    return this.$translate.use();
  }

  get onLangChange(): Observable<{ lang: string }> {
    return this.langChange$.asObservable();
  }

  get(key: string, params?: Record<string, unknown>): Observable<string> {
    return new Observable<string>((subscriber) => {
      let cancelled = false;
      Promise.resolve(this.$translate(key, params)).then(
        (value) => {
          if (cancelled) return;
          subscriber.next(value);
          subscriber.complete();
        },
        (error) => {
          if (!cancelled) subscriber.error(error);
        },
      );
      return () => {
        cancelled = true;
      };
    });
  }

  instant(key: string, params?: Record<string, unknown>): string {
    return this.$translate.instant(key, params);
  }

  stream(key: string, params?: Record<string, unknown>): Observable<string> {
    return new Observable<string>((subscriber) => {
      const emit = () => {
        Promise.resolve(this.$translate(key, params)).then(
          (value) => subscriber.next(value),
          (error) => subscriber.error(error),
        );
      };
      emit();
      const sub = this.langChange$.subscribe(emit);
      return () => sub.unsubscribe();
    });
  }

  use(lang: string): Promise<string> {
    return Promise.resolve(this.$translate.use(lang));
  }
}

/**
 * `LOCALE_ID` — mismo token que `@angular/core`. Lo provee el módulo de i18n
 * (factory que devuelve `$translate.use()`). El swap de `$locale` (fechas /
 * números / moneda) al cambiar de idioma lo hace un `.run` con lo que se haya
 * pasado a `registerLocaleData` — ver `@/i18n/locale-data.ts`.
 */
export const LOCALE_ID = new InjectionToken<string>("LOCALE_ID");
