import { afterEach, describe, expect, it } from "vitest";
import {
  BrowserPlatformLocation,
  HashLocationStrategy,
  type Location,
  LocationImpl,
  PathLocationStrategy,
} from "@/common/index.ts";

/**
 * `Location` sobre la estrategia que elegiría el router (`withHashLocation()` → hash). Qué estrategia provee
 * `RouterModule.forRoot` lo cubre `router/router-location.compiled.test.ts`.
 */
function bootLocation(hash = false): Location {
  const platform = new BrowserPlatformLocation(window, document);
  return new LocationImpl(hash ? new HashLocationStrategy(platform, "") : new PathLocationStrategy(platform, "/"));
}

afterEach(() => {
  window.history.pushState(null, "", "/");
});

describe("etapa 14 — platform-browser: Location", () => {
  it("go() cambia la URL; path() la lee de vuelta", () => {
    const location = bootLocation();

    location.go("/users/42");
    expect(location.path()).toBe("/users/42");
    expect(window.location.pathname).toBe("/users/42");
  });

  it("go() con query; path() incluye el ?query", () => {
    const location = bootLocation();

    location.go("/search", "q=hola");
    expect(location.path()).toBe("/search?q=hola");
    expect(location.isCurrentPathEqualTo("/search", "q=hola")).toBe(true);
  });

  it("replaceState() cambia la URL sin apilar", () => {
    const location = bootLocation();

    location.go("/a");
    location.replaceState("/b");
    expect(location.path()).toBe("/b");
  });

  it("onUrlChange() se dispara en go()/replaceState()", () => {
    const location = bootLocation();
    const seen: [string, unknown][] = [];
    const off = location.onUrlChange((url, state) => seen.push([url, state]));

    location.go("/x", "", { n: 1 });
    location.replaceState("/y");
    off();
    location.go("/z");

    expect(seen).toEqual([
      ["/x", { n: 1 }],
      ["/y", null],
    ]);
  });

  it("con withHashLocation() la URL va después del #", () => {
    const location = bootLocation(true);

    location.go("/dash");
    expect(window.location.hash).toBe("#/dash");
    expect(location.path()).toBe("/dash");
  });

  it("getState() devuelve el history.state", () => {
    const location = bootLocation();

    location.go("/s", "", { tab: "info" });
    expect(location.getState()).toEqual({ tab: "info" });
  });
});
