import type { Subscription } from "rxjs";
import { EventEmitter } from "@/event-emitter.ts";
import { LocationStrategy } from "@/common/location/location-strategy.ts";
import type { LocationChangeEvent } from "@/common/location/platform-location.ts";
import { joinWithSlash, normalizeQueryParams, stripTrailingSlash } from "@/common/location/util.ts";

/** Payload de `Location.subscribe` — igual que el `PopStateEvent` (deprecado) de `@angular/common`. */
export interface LocationEvent {
  pop?: boolean;
  state?: unknown;
  type?: string;
  url?: string;
}

function stripIndexHtml(url: string): string {
  return url.replace(/\/index\.html$/, "");
}

function stripBasePath(basePath: string, url: string): string {
  if (!basePath || !url.startsWith(basePath)) return url;
  const stripped = url.substring(basePath.length);
  if (stripped === "" || ["/", ";", "?", "#"].includes(stripped[0])) return stripped;
  return url;
}

function stripOrigin(baseHref: string): string {
  const isAbsoluteUrl = /^(?:[a-z+]+:)?\/\//i.test(baseHref);
  if (isAbsoluteUrl) {
    const [, pathname] = baseHref.split(/\/\/[^/]+/);
    return pathname;
  }
  return baseHref;
}

/**
 * `Location` — el servicio que se inyecta para leer/cambiar la URL **sin** el
 * Router (un botón "cancelar" con `back()`, leer `path()` para analytics, …).
 * Port de `@angular/common`. Se apoya en `LocationStrategy` (que lo provee
 * `RouterModule.forRoot`). `subscribe()` emite en back/forward del navegador;
 * `onUrlChange()` además en `go()`/`replaceState()` de esta instancia.
 */
export abstract class Location {
  static readonly $name = "Location";

  abstract path(includeHash?: boolean): string;
  abstract getState(): unknown;
  abstract isCurrentPathEqualTo(path: string, query?: string): boolean;
  abstract normalize(url: string): string;
  abstract prepareExternalUrl(url: string): string;
  abstract go(path: string, query?: string, state?: unknown): void;
  abstract replaceState(path: string, query?: string, state?: unknown): void;
  abstract forward(): void;
  abstract back(): void;
  abstract historyGo(relativePosition?: number): void;
  abstract onUrlChange(fn: (url: string, state: unknown) => void): () => void;
  abstract subscribe(
    onNext: (value: LocationEvent) => void,
    onThrow?: ((error: unknown) => void) | null,
    onReturn?: (() => void) | null,
  ): Subscription;

  static normalizeQueryParams = normalizeQueryParams;
  static joinWithSlash = joinWithSlash;
  static stripTrailingSlash = stripTrailingSlash;
}

export class LocationImpl extends Location {
  static readonly $inject = [LocationStrategy.$name];

  private readonly subject = new EventEmitter<LocationEvent>();
  private readonly basePath: string;
  private readonly urlChangeListeners: ((url: string, state: unknown) => void)[] = [];
  private urlChangeSubscription: Subscription | null = null;

  constructor(private readonly locationStrategy: LocationStrategy) {
    super();
    const baseHref = this.locationStrategy.getBaseHref();
    this.basePath = stripOrigin(stripTrailingSlash(stripIndexHtml(baseHref)));
    this.locationStrategy.onPopState((ev: LocationChangeEvent) => {
      this.subject.emit({ url: this.path(true), pop: true, state: ev.state, type: ev.type });
    });
  }

  path(includeHash = false): string {
    return this.normalize(this.locationStrategy.path(includeHash));
  }

  getState(): unknown {
    return this.locationStrategy.getState();
  }

  isCurrentPathEqualTo(path: string, query = ""): boolean {
    return this.path() === this.normalize(path + normalizeQueryParams(query));
  }

  normalize(url: string): string {
    return stripTrailingSlash(stripBasePath(this.basePath, stripIndexHtml(url)));
  }

  prepareExternalUrl(url: string): string {
    const normalized = url && url[0] !== "/" ? `/${url}` : url;
    return this.locationStrategy.prepareExternalUrl(normalized);
  }

  go(path: string, query = "", state: unknown = null): void {
    this.locationStrategy.pushState(state, "", path, query);
    this.notifyUrlChangeListeners(this.prepareExternalUrl(path + normalizeQueryParams(query)), state);
  }

  replaceState(path: string, query = "", state: unknown = null): void {
    this.locationStrategy.replaceState(state, "", path, query);
    this.notifyUrlChangeListeners(this.prepareExternalUrl(path + normalizeQueryParams(query)), state);
  }

  forward(): void {
    this.locationStrategy.forward();
  }

  back(): void {
    this.locationStrategy.back();
  }

  historyGo(relativePosition = 0): void {
    this.locationStrategy.historyGo(relativePosition);
  }

  onUrlChange(fn: (url: string, state: unknown) => void): () => void {
    this.urlChangeListeners.push(fn);
    this.urlChangeSubscription ??= this.subscribe((v) => this.notifyUrlChangeListeners(v.url ?? "", v.state));
    return () => {
      const i = this.urlChangeListeners.indexOf(fn);
      if (i > -1) this.urlChangeListeners.splice(i, 1);
      if (this.urlChangeListeners.length === 0) {
        this.urlChangeSubscription?.unsubscribe();
        this.urlChangeSubscription = null;
      }
    };
  }

  subscribe(
    onNext: (value: LocationEvent) => void,
    onThrow?: ((error: unknown) => void) | null,
    onReturn?: (() => void) | null,
  ): Subscription {
    return this.subject.subscribe({
      next: onNext,
      error: onThrow ?? undefined,
      complete: onReturn ?? undefined,
    });
  }

  private notifyUrlChangeListeners(url = "", state: unknown): void {
    for (const fn of this.urlChangeListeners) fn(url, state);
  }
}
