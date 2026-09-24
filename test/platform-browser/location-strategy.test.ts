import { describe, expect, it } from "vitest";
import { BrowserPlatformLocation, HashLocationStrategy, PathLocationStrategy } from "@/common/index.ts";

/**
 * Las dos estrategias. Qué provee cada módulo (`CommonModule` da `PlatformLocation` pero no `LocationStrategy`;
 * `RouterModule.forRoot` elige según `withHashLocation()`) y el override de `APP_BASE_HREF` por DI lo cubren
 * `platform-browser.compiled.test.ts` y `router/router-location.compiled.test.ts`.
 */
describe("etapa 14 — platform-browser: LocationStrategy / PlatformLocation", () => {
  const platform = () => new BrowserPlatformLocation(window, document);

  it("PlatformLocation lee window.location", () => {
    expect(platform().pathname).toBe(window.location.pathname);
  });

  it("PathLocationStrategy: base href \"/\" → la URL tal cual", () => {
    const strategy = new PathLocationStrategy(platform(), "/");
    expect(strategy.getBaseHref()).toBe("/");
    expect(strategy.prepareExternalUrl("/users/42")).toBe("/users/42");
  });

  it("HashLocationStrategy: la URL va después del #", () => {
    const strategy = new HashLocationStrategy(platform(), "");
    expect(strategy.prepareExternalUrl("/users/42")).toBe("#/users/42");
  });

  it("APP_BASE_HREF (\"/app\") → PathLocationStrategy lo usa en prepareExternalUrl", () => {
    const strategy = new PathLocationStrategy(platform(), "/app");
    expect(strategy.getBaseHref()).toBe("/app");
    expect(strategy.prepareExternalUrl("/x")).toBe("/app/x");
  });
});
