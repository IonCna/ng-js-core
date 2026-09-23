import { DOCUMENT } from "@/core/dom-tokens.ts";

export interface LocationChangeEvent {
  type: string;
  state: unknown;
}
export type LocationChangeListener = (event: LocationChangeEvent) => void;

/**
 * `PlatformLocation` — la capa más baja de `@angular/common`: un wrapper fino
 * sobre `window.location` + `window.history`. Existe para que `LocationStrategy`
 * no toque `window` directo (testeable / SSR). Acá se apoya en `$window`.
 */
export abstract class PlatformLocation {
  static readonly $name = "PlatformLocation";

  abstract get href(): string;
  abstract get protocol(): string;
  abstract get hostname(): string;
  abstract get port(): string;
  abstract get pathname(): string;
  abstract get search(): string;
  abstract get hash(): string;

  abstract getBaseHrefFromDOM(): string;
  abstract getState(): unknown;

  abstract onPopState(fn: LocationChangeListener): () => void;
  abstract onHashChange(fn: LocationChangeListener): () => void;

  abstract pushState(state: unknown, title: string, url: string): void;
  abstract replaceState(state: unknown, title: string, url: string): void;
  abstract forward(): void;
  abstract back(): void;
  abstract historyGo(relativePosition: number): void;
}

export class BrowserPlatformLocation extends PlatformLocation {
  static readonly $inject = ["$window", DOCUMENT.toString()];

  constructor(
    private readonly win: Window,
    private readonly doc: Document,
  ) {
    super();
  }

  private get loc(): Location {
    return this.win.location;
  }
  private get hist(): History {
    return this.win.history;
  }

  get href(): string {
    return this.loc.href;
  }
  get protocol(): string {
    return this.loc.protocol;
  }
  get hostname(): string {
    return this.loc.hostname;
  }
  get port(): string {
    return this.loc.port;
  }
  get pathname(): string {
    return this.loc.pathname;
  }
  get search(): string {
    return this.loc.search;
  }
  get hash(): string {
    return this.loc.hash;
  }

  getBaseHrefFromDOM(): string {
    return this.doc.querySelector("base")?.getAttribute("href") ?? "";
  }
  getState(): unknown {
    return this.hist.state;
  }

  onPopState(fn: LocationChangeListener): () => void {
    const handler = (e: PopStateEvent) => fn({ type: "popstate", state: e.state });
    this.win.addEventListener("popstate", handler as EventListener, false);
    return () => this.win.removeEventListener("popstate", handler as EventListener, false);
  }
  onHashChange(fn: LocationChangeListener): () => void {
    const handler = () => fn({ type: "hashchange", state: null });
    this.win.addEventListener("hashchange", handler, false);
    return () => this.win.removeEventListener("hashchange", handler, false);
  }

  pushState(state: unknown, title: string, url: string): void {
    this.hist.pushState(state, title, url);
  }
  replaceState(state: unknown, title: string, url: string): void {
    this.hist.replaceState(state, title, url);
  }
  forward(): void {
    this.hist.forward();
  }
  back(): void {
    this.hist.back();
  }
  historyGo(relativePosition = 0): void {
    this.hist.go(relativePosition);
  }
}
