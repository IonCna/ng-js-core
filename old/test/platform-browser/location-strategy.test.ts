import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import {
  APP_BASE_HREF,
  HashLocationStrategy,
  LocationStrategy,
  PathLocationStrategy,
  PlatformLocation,
} from "@/common/index.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule, withHashLocation } from "@/router/index.ts";
import { PlatformBrowserModule } from "@/runtime/platform-browser/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "ls-root", template: "<ui-view></ui-view>" })
class LsRoot {}
@Component({ selector: "ls-home", template: "<h1>home</h1>" })
class LsHome {}

const routes: Routes = [{ path: "", component: LsHome }];

async function bootRouter(feature?: ReturnType<typeof withHashLocation>) {
  @NgModule({
    imports: [RouterModule.forRoot(routes, ...(feature ? [feature] : []))],
    declarations: [LsRoot, LsHome],
  })
  class AppModule {}

  const host = document.createElement("ls-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(AppModule, { hostElement: host });
  return (appRef.injector as angular.auto.IInjectorService).get.bind(appRef.injector) as <T>(name: string) => T;
}

describe("etapa 14 — platform-browser: LocationStrategy / PlatformLocation", () => {
  it("PlatformBrowserModule provee PlatformLocation, no LocationStrategy", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [PlatformBrowserModule.name], { strictDi: false });

    const pl = injector.get<PlatformLocation>(PlatformLocation.$name);
    expect(pl.pathname).toBe(window.location.pathname);
    expect(injector.has(LocationStrategy.$name)).toBe(false);
  });

  it("RouterModule.forRoot sin feature → PathLocationStrategy", async () => {
    const get = await bootRouter();
    const strategy = get<LocationStrategy>(LocationStrategy.$name);
    expect(strategy).toBeInstanceOf(PathLocationStrategy);
    expect(strategy.getBaseHref()).toBe("/");
    expect(strategy.prepareExternalUrl("/users/42")).toBe("/users/42");
  });

  it("RouterModule.forRoot(routes, withHashLocation()) → HashLocationStrategy", async () => {
    const get = await bootRouter(withHashLocation());
    const strategy = get<LocationStrategy>(LocationStrategy.$name);
    expect(strategy).toBeInstanceOf(HashLocationStrategy);
    expect(strategy.prepareExternalUrl("/users/42")).toBe("#/users/42");
  });

  it("APP_BASE_HREF override → PathLocationStrategy lo usa en prepareExternalUrl", () => {
    const name = `lsBaseHref${Date.now()}`;
    angular
      .module(name, ["ng.js.platform-browser"])
      .value(APP_BASE_HREF.toString(), "/app")
      .service(LocationStrategy.$name, PathLocationStrategy);

    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });

    const strategy = injector.get<LocationStrategy>(LocationStrategy.$name);
    expect(strategy.getBaseHref()).toBe("/app");
    expect(strategy.prepareExternalUrl("/x")).toBe("/app/x");
  });
});
