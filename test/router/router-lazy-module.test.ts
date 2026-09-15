import "reflect-metadata";
import "zone.js";
import type { StateService } from "@uirouter/angularjs";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "lm-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class LmRoot {}

@Component({ selector: "lm-home", template: "<h1>home</h1>" })
class LmHome {}

let loads = 0;

const routes: Routes = [
  { path: "", component: LmHome },
  {
    path: "admin",
    loadChildren: () => {
      loads += 1;
      return import("./lazy-admin.module.ts").then((m) => m.AdminModule);
    },
  },
  {
    path: "admin-default",
    loadChildren: () => import("./lazy-admin.module.ts").then((m) => ({ default: m.AdminModule })),
  },
];

@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [LmRoot, LmHome] })
class AppModule {}

async function boot() {
  const host = document.createElement("lm-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(AppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    host,
    appRef,
    injector,
    router: injector.get<Router>(Router.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

async function settle($rootScope: angular.IRootScopeService, nav: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 20; i++) {
    $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await nav;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — loadChildren con @NgModule lazy", () => {
  it("baja el módulo: registra declarations + providers y monta la ruta índice", async () => {
    const { host, appRef, router, $rootScope } = await boot();
    $rootScope.$digest();
    expect(host.textContent).toContain("home");

    await settle($rootScope, router.navigateByUrl("/admin"));

    expect(host.textContent).toContain("hola admin");
    expect(host.textContent).toContain("badge");
    expect(document.title).toBe("Admin");
    appRef.destroy();
  });

  it("resuelve rutas hijas con param del forChild, y no recarga el módulo", async () => {
    loads = 0;
    const { host, appRef, router, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/admin/users/7"));
    expect(host.textContent).toContain("admin user 7");

    await settle($rootScope, router.navigateByUrl("/admin"));
    expect(host.textContent).toContain("hola admin");
    expect(loads).toBe(1);
    appRef.destroy();
  });

  it("acepta { default: NgModule } (y `admin` no captura `/admin-default` por prefijo)", async () => {
    loads = 0;
    const { host, appRef, router, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/admin-default/users/3"));
    expect(host.textContent).toContain("admin user 3");
    expect(loads).toBe(0);
    appRef.destroy();
  });

  it("el forChild del chunk lazy no registra estados en la raíz", async () => {
    const { appRef, router, injector, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/admin"));
    const $state = injector.get<StateService>("$state");
    const names = $state.get().map((s) => s.name);
    expect(names).not.toContain("users_id");
    expect(names).toContain("admin.users_id");
    appRef.destroy();
  });
});
