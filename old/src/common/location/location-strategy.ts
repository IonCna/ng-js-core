import { InjectionToken } from "@/core/di/injection-token.ts";
import {
  type LocationChangeListener,
  PlatformLocation,
} from "@/common/location/platform-location.ts";
import { joinWithSlash, normalizeQueryParams } from "@/common/location/util.ts";

/**
 * `APP_BASE_HREF` — base href por código, en vez de `<base href>` en el HTML.
 * Mismo token que `@angular/common`. `runtime/platform-browser` lo provee con
 * `"/"` por default.
 */
export const APP_BASE_HREF = new InjectionToken<string>("APP_BASE_HREF");

/**
 * `LocationStrategy` — decide **cómo se representa el path en la URL**. Dos
 * impls: `PathLocationStrategy` (History API, `/users/42`) y
 * `HashLocationStrategy` (`/#/users/42`). Delega el manoseo real de `window` en
 * `PlatformLocation`. Cuál queda activa lo elige `RouterModule.forRoot`
 * (`withHashLocation()` → `HashLocationStrategy`).
 */
export abstract class LocationStrategy {
  static readonly $name = "LocationStrategy";

  abstract path(includeHash?: boolean): string;
  abstract prepareExternalUrl(internal: string): string;
  abstract getState(): unknown;
  abstract pushState(state: unknown, title: string, url: string, queryParams: string): void;
  abstract replaceState(state: unknown, title: string, url: string, queryParams: string): void;
  abstract forward(): void;
  abstract back(): void;
  abstract historyGo(relativePosition: number): void;
  abstract onPopState(fn: LocationChangeListener): void;
  abstract getBaseHref(): string;
}

/** `/users/42` — History API. Necesita un base href (`<base>` o `APP_BASE_HREF`). */
export class PathLocationStrategy extends LocationStrategy {
  static readonly $inject = [PlatformLocation.$name, APP_BASE_HREF.toString()];

  private readonly baseHref: string;

  constructor(
    private readonly platformLocation: PlatformLocation,
    href?: string,
  ) {
    super();
    this.baseHref = href ?? platformLocation.getBaseHrefFromDOM() ?? "";
  }

  getBaseHref(): string {
    return this.baseHref;
  }

  getState(): unknown {
    return this.platformLocation.getState();
  }

  onPopState(fn: LocationChangeListener): void {
    this.platformLocation.onPopState(fn);
    this.platformLocation.onHashChange(fn);
  }

  prepareExternalUrl(internal: string): string {
    return joinWithSlash(this.baseHref, internal);
  }

  path(includeHash = false): string {
    const pathname = this.platformLocation.pathname + normalizeQueryParams(this.platformLocation.search);
    const hash = this.platformLocation.hash;
    return hash && includeHash ? `${pathname}${hash}` : pathname;
  }

  pushState(state: unknown, title: string, url: string, queryParams: string): void {
    const externalUrl = this.prepareExternalUrl(url + normalizeQueryParams(queryParams));
    this.platformLocation.pushState(state, title, externalUrl);
  }

  replaceState(state: unknown, title: string, url: string, queryParams: string): void {
    const externalUrl = this.prepareExternalUrl(url + normalizeQueryParams(queryParams));
    this.platformLocation.replaceState(state, title, externalUrl);
  }

  forward(): void {
    this.platformLocation.forward();
  }
  back(): void {
    this.platformLocation.back();
  }
  historyGo(relativePosition = 0): void {
    this.platformLocation.historyGo(relativePosition);
  }
}

/** `/#/users/42` — el path va después del `#`. Anda sin config del server. */
export class HashLocationStrategy extends LocationStrategy {
  static readonly $inject = [PlatformLocation.$name, APP_BASE_HREF.toString()];

  private readonly baseHref: string;

  constructor(
    private readonly platformLocation: PlatformLocation,
    href?: string,
  ) {
    super();
    this.baseHref = href ?? "";
  }

  getBaseHref(): string {
    return this.baseHref;
  }

  getState(): unknown {
    return this.platformLocation.getState();
  }

  onPopState(fn: LocationChangeListener): void {
    this.platformLocation.onPopState(fn);
    this.platformLocation.onHashChange(fn);
  }

  prepareExternalUrl(internal: string): string {
    const url = joinWithSlash(this.baseHref, internal);
    return url.length > 0 ? `#${url}` : url;
  }

  path(_includeHash = false): string {
    // El `#` ya contiene todo el path de la app; `includeHash` no aplica.
    const path = this.platformLocation.hash ?? "#";
    return path.length > 0 ? path.substring(1) : path;
  }

  pushState(state: unknown, title: string, path: string, queryParams: string): void {
    let url: string | null = this.prepareExternalUrl(path + normalizeQueryParams(queryParams));
    if (url.length === 0) url = this.platformLocation.pathname;
    this.platformLocation.pushState(state, title, url);
  }

  replaceState(state: unknown, title: string, path: string, queryParams: string): void {
    let url: string | null = this.prepareExternalUrl(path + normalizeQueryParams(queryParams));
    if (url.length === 0) url = this.platformLocation.pathname;
    this.platformLocation.replaceState(state, title, url);
  }

  forward(): void {
    this.platformLocation.forward();
  }
  back(): void {
    this.platformLocation.back();
  }
  historyGo(relativePosition = 0): void {
    this.platformLocation.historyGo(relativePosition);
  }
}
