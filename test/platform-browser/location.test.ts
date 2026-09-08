import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { Location } from "@/platform-browser/index.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule, withHashLocation } from "@/router/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "loc-root", template: "<ui-view></ui-view>" })
class LocRoot {}
@Component({ selector: "loc-home", template: "<h1>home</h1>" })
class LocHome {}

const routes: Routes = [{ path: "", component: LocHome }];

async function bootLocation(feature?: ReturnType<typeof withHashLocation>): Promise<Location> {
  @NgModule({
    imports: [RouterModule.forRoot(routes, ...(feature ? [feature] : []))],
    declarations: [LocRoot, LocHome],
  })
  class AppModule {}

  const host = document.createElement("loc-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(AppModule, { hostElement: host });
  return (appRef.injector as angular.auto.IInjectorService).get<Location>(Location.$name);
}

afterEach(() => {
  window.history.pushState(null, "", "/");
});

describe("etapa 14 — platform-browser: Location", () => {
  it("go() cambia la URL; path() la lee de vuelta", async () => {
    const location = await bootLocation();

    location.go("/users/42");
    expect(location.path()).toBe("/users/42");
    expect(window.location.pathname).toBe("/users/42");
  });

  it("go() con query; path() incluye el ?query", async () => {
    const location = await bootLocation();

    location.go("/search", "q=hola");
    expect(location.path()).toBe("/search?q=hola");
    expect(location.isCurrentPathEqualTo("/search", "q=hola")).toBe(true);
  });

  it("replaceState() cambia la URL sin apilar", async () => {
    const location = await bootLocation();

    location.go("/a");
    location.replaceState("/b");
    expect(location.path()).toBe("/b");
  });

  it("onUrlChange() se dispara en go()/replaceState()", async () => {
    const location = await bootLocation();
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

  it("con withHashLocation() la URL va después del #", async () => {
    const location = await bootLocation(withHashLocation());

    location.go("/dash");
    expect(window.location.hash).toBe("#/dash");
    expect(location.path()).toBe("/dash");
  });

  it("getState() devuelve el history.state", async () => {
    const location = await bootLocation();

    location.go("/s", "", { tab: "info" });
    expect(location.getState()).toEqual({ tab: "info" });
  });
});
