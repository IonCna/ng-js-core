import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { type Observable, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Route, Routes } from "@/router/index.ts";
import { PreloadAllModules, type PreloadingStrategy, Router, RouterModule, withPreloading } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";
import { preloadCounters, resetPreloadCounters } from "./preload/counters.ts";

@Component({ selector: "pl-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class PlRoot {}

@Component({ selector: "pl-home", template: "<h1>home</h1>" })
class PlHome {}

function lazyRoutes(): Routes {
  return [
    { path: "", component: PlHome },
    {
      path: "admin",
      data: { preload: true },
      loadChildren: () => {
        preloadCounters.admin += 1;
        return import("./lazy-admin.module.ts").then((m) => m.AdminModule);
      },
    },
    {
      path: "nested",
      loadChildren: () => {
        preloadCounters.nested += 1;
        return import("./preload/nested.routes.ts").then((m) => m.NESTED_ROUTES);
      },
    },
    {
      path: "page",
      loadComponent: () => {
        preloadCounters.page += 1;
        return import("./lazy-page.component.ts");
      },
    },
  ];
}

async function boot(appModule: Function) {
  const host = document.createElement("pl-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(appModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    host,
    appRef,
    router: injector.get<Router>(Router.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

async function settle($rootScope: angular.IRootScopeService, nav?: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (!$rootScope.$$phase) $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await nav;
}

beforeEach(() => resetPreloadCounters());

afterEach(() => {
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — withPreloading", () => {
  it("PreloadAllModules baja loadChildren (@NgModule y Routes), loadComponent y los lazy anidados", async () => {
    @NgModule({
      imports: [CommonModule, RouterModule.forRoot(lazyRoutes(), withPreloading(PreloadAllModules))],
      declarations: [PlRoot, PlHome],
    })
    class AppModule {}

    const { host, appRef, router, $rootScope } = await boot(AppModule);
    await settle($rootScope);

    expect(host.textContent).toContain("home");
    expect(preloadCounters).toMatchObject({ admin: 1, nested: 1, deep: 1, page: 1 });

    // Ya precargado: navegar no vuelve a bajar nada.
    await settle($rootScope, router.navigateByUrl("/admin"));
    expect(host.textContent).toContain("hola admin");
    await settle($rootScope, router.navigateByUrl("/nested/deep"));
    expect(host.textContent).toContain("deep page");
    await settle($rootScope, router.navigateByUrl("/page"));
    expect(host.textContent).toContain("lazy loaded");
    expect(preloadCounters).toMatchObject({ admin: 1, nested: 1, deep: 1, page: 1 });
    appRef.destroy();
  });

  it("navegar a un chunk mientras se precarga no lo registra dos veces", async () => {
    @NgModule({
      imports: [CommonModule, RouterModule.forRoot(lazyRoutes(), withPreloading(PreloadAllModules))],
      declarations: [PlRoot, PlHome],
    })
    class AppModule {}

    const { host, appRef, router, $rootScope } = await boot(AppModule);
    const errors: unknown[] = [];
    // Primera navegación (home) termina → arranca el preload en un microtask → sin
    // esperar a que baje el chunk, navegar a /admin pide el mismo `lazyLoad`.
    while (!host.textContent?.includes("home")) {
      $rootScope.$digest();
      await Promise.resolve();
    }
    await Promise.resolve();
    expect(preloadCounters.admin).toBe(1); // preload en curso
    const nav = router.navigateByUrl("/admin/users/5").catch((error: unknown) => errors.push(error));
    await settle($rootScope, nav);

    expect(errors).toEqual([]);
    expect(host.textContent).toContain("admin user 5");
    expect(preloadCounters.admin).toBe(1);
    appRef.destroy();
  });

  it("estrategia custom (con DI de constructor) decide qué rutas precargar", async () => {
    class OnlyFlagged implements PreloadingStrategy {
      static readonly $inject = ["$q"];
      constructor(readonly $q: angular.IQService) {}
      preload(route: Route, fn: () => Observable<unknown>): Observable<unknown> {
        if (!this.$q) throw new Error("sin DI");
        if (route.data?.preload) return fn();
        preloadCounters.skipped += 1;
        return of(null);
      }
    }

    @NgModule({
      imports: [CommonModule, RouterModule.forRoot(lazyRoutes(), withPreloading(OnlyFlagged))],
      declarations: [PlRoot, PlHome],
    })
    class AppModule {}

    const { appRef, $rootScope } = await boot(AppModule);
    await settle($rootScope);

    expect(preloadCounters).toMatchObject({ admin: 1, nested: 0, page: 0, skipped: 2 });
    appRef.destroy();
  });
});
