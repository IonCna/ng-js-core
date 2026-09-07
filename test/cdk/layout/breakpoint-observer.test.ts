import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BreakpointObserver, Breakpoints, MediaMatcher } from "@/cdk/layout/index.ts";
import { LayoutModule } from "@/runtime/cdk/layout/index.ts";

/** `MediaQueryList` falso controlable — patrón `FakeMediaQueryList` de `@angular/cdk/layout/testing`. */
class FakeMediaQueryList {
  matches = false;
  private readonly listeners = new Set<(e: MediaQueryListEvent) => void>();
  constructor(public media: string) {}
  addEventListener(_type: string, fn: (e: MediaQueryListEvent) => void): void {
    this.listeners.add(fn);
  }
  removeEventListener(_type: string, fn: (e: MediaQueryListEvent) => void): void {
    this.listeners.delete(fn);
  }
  emit(matches: boolean): void {
    this.matches = matches;
    for (const fn of this.listeners) fn({ matches, media: this.media } as MediaQueryListEvent);
  }
}

let registry: Map<string, FakeMediaQueryList>;
let originalMatchMedia: typeof window.matchMedia | undefined;

function fakeFor(query: string): FakeMediaQueryList {
  let mql = registry.get(query);
  if (!mql) {
    mql = new FakeMediaQueryList(query);
    registry.set(query, mql);
  }
  return mql;
}

function boot(): BreakpointObserver {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [LayoutModule.name], { strictDi: false });
  return injector.get<BreakpointObserver>(BreakpointObserver.$name);
}

const tick = () => new Promise((r) => setTimeout(r));

beforeEach(() => {
  registry = new Map();
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => fakeFor(query) as unknown as MediaQueryList) as typeof window.matchMedia;
});

afterEach(() => {
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  else Reflect.deleteProperty(window, "matchMedia");
});

describe("etapa 14 — cdk/layout: BreakpointObserver", () => {
  it("MediaMatcher delega en window.matchMedia", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [LayoutModule.name], { strictDi: false });
    const mm = injector.get<MediaMatcher>(MediaMatcher.$name);
    expect(mm.matchMedia("(min-width: 100px)")).toBe(registry.get("(min-width: 100px)"));
  });

  it("isMatched() refleja el estado actual del MediaQueryList", () => {
    const bo = boot();
    const q = "(max-width: 600px)";
    expect(bo.isMatched(q)).toBe(false);
    fakeFor(q).emit(true);
    expect(bo.isMatched(q)).toBe(true);
  });

  it("observe() emite el estado inicial y de nuevo al cruzar el breakpoint", async () => {
    const bo = boot();
    const q = "(max-width: 600px)";
    const states: { matches: boolean; breakpoints: Record<string, boolean> }[] = [];
    bo.observe(q).subscribe((s) => states.push(s));

    // primer estado, sincrónico
    expect(states).toEqual([{ matches: false, breakpoints: { [q]: false } }]);

    fakeFor(q).emit(true);
    await tick(); // las emisiones subsiguientes van con debounceTime(0)

    expect(states).toHaveLength(2);
    expect(states[1]).toEqual({ matches: true, breakpoints: { [q]: true } });
  });

  it("una media query compuesta (con coma) se parte y matchea si alguna aplica", async () => {
    const bo = boot();
    const [a, b] = Breakpoints.Handset.split(",").map((s) => s.trim());
    const states: { matches: boolean; breakpoints: Record<string, boolean> }[] = [];
    bo.observe(Breakpoints.Handset).subscribe((s) => states.push(s));

    expect(states[0].breakpoints).toEqual({ [a]: false, [b]: false });
    expect(states[0].matches).toBe(false);

    fakeFor(b).emit(true);
    await tick();

    expect(states.at(-1)?.matches).toBe(true);
    expect(states.at(-1)?.breakpoints).toEqual({ [a]: false, [b]: true });
  });

  it("Breakpoints trae los strings de Material", () => {
    expect(Breakpoints.XSmall).toBe("(max-width: 599.98px)");
    expect(Breakpoints.Web).toContain("(min-width: 840px) and (orientation: portrait)");
  });
});
