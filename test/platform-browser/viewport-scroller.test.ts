import angular from "angular";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewportScroller } from "@/platform-browser/index.ts";
import { PlatformBrowserModule } from "@/runtime/platform-browser/index.ts";

let scrollToSpy: ReturnType<typeof vi.fn>;
let originalScrollTo: typeof window.scrollTo;
let restoration: string;

function boot(): ViewportScroller {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [PlatformBrowserModule.name], { strictDi: false });
  return injector.get<ViewportScroller>(ViewportScroller.$name);
}

beforeEach(() => {
  originalScrollTo = window.scrollTo;
  scrollToSpy = vi.fn();
  window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  // jsdom no implementa history.scrollRestoration — le damos un accessor real.
  restoration = "auto";
  Object.defineProperty(window.history, "scrollRestoration", {
    configurable: true,
    get: () => restoration,
    set: (v: string) => {
      restoration = v;
    },
  });
});

afterEach(() => {
  window.scrollTo = originalScrollTo;
  Reflect.deleteProperty(window.history, "scrollRestoration");
  document.body.querySelectorAll("[data-vs]").forEach((el) => el.remove());
});

describe("etapa 14 — platform-browser: ViewportScroller", () => {
  it("scrollToPosition delega en window.scrollTo", () => {
    boot().scrollToPosition([0, 500]);
    expect(scrollToSpy).toHaveBeenCalledWith(0, 500);
  });

  it("getScrollPosition devuelve [scrollX, scrollY]", () => {
    expect(boot().getScrollPosition()).toEqual([window.scrollX, window.scrollY]);
  });

  it("scrollToAnchor busca por id, hace scroll y enfoca", () => {
    const el = document.createElement("div");
    el.id = "sec";
    el.tabIndex = -1;
    el.setAttribute("data-vs", "");
    el.getBoundingClientRect = () => ({ top: 200, left: 0 }) as DOMRect;
    document.body.appendChild(el);

    boot().scrollToAnchor("sec");

    expect(scrollToSpy).toHaveBeenCalledWith(0, 200);
    expect(document.activeElement).toBe(el);
  });

  it("setOffset se resta al hacer scrollToAnchor", () => {
    const el = document.createElement("div");
    el.id = "sec2";
    el.setAttribute("data-vs", "");
    el.getBoundingClientRect = () => ({ top: 200, left: 50 }) as DOMRect;
    document.body.appendChild(el);

    const vs = boot();
    vs.setOffset([10, 60]);
    vs.scrollToAnchor("sec2");

    expect(scrollToSpy).toHaveBeenCalledWith(40, 140);
  });

  it("scrollToAnchor con ancla inexistente no hace nada", () => {
    boot().scrollToAnchor("no-existe");
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("setHistoryScrollRestoration setea window.history.scrollRestoration", () => {
    boot().setHistoryScrollRestoration("manual");
    expect(window.history.scrollRestoration).toBe("manual");
  });
});
