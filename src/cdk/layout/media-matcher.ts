/**
 * `MediaMatcher` — wrapper fino sobre `window.matchMedia`. Igual que
 * `@angular/cdk/layout`. Existe para testear / no romper donde `matchMedia` no
 * está (jsdom, SSR): en ese caso devuelve un `MediaQueryList` falso con
 * `matches: false` y listeners no-op.
 */
export abstract class MediaMatcher {
  static readonly $name = "MediaMatcher";
  abstract matchMedia(query: string): MediaQueryList;
}

function noopMediaQueryList(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
}

export class MediaMatcherImpl extends MediaMatcher {
  static readonly $inject: readonly string[] = [];

  private readonly cache = new Map<string, MediaQueryList>();

  matchMedia(query: string): MediaQueryList {
    let mql = this.cache.get(query);
    if (!mql) {
      const mm = typeof window !== "undefined" ? window.matchMedia : undefined;
      mql = typeof mm === "function" ? mm.call(window, query) : noopMediaQueryList(query);
      this.cache.set(query, mql);
    }
    return mql;
  }
}
