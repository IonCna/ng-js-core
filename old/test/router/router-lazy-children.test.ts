import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "lc-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class LcRoot {}

@Component({ selector: "lc-home", template: "<h1>home</h1>" })
class LcHome {}

let guardHits = 0;

const routes: Routes = [
  { path: "", component: LcHome },
  {
    path: "admin",
    canActivate: [
      () => {
        guardHits += 1;
        return true;
      },
    ],
    loadChildren: () => import("./lazy-children.routes.ts").then((m) => m.CHILD_ROUTES),
  },
];

@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [LcRoot, LcHome] })
class AppModule {}

async function boot() {
  const host = document.createElement("lc-root");
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

describe("ngjs-core/router — loadChildren lazy", () => {
  it("navega a /admin/users: baja el chunk y monta el componente lazy", async () => {
    const { host, appRef, router, $rootScope } = await boot();
    $rootScope.$digest();
    expect(host.textContent).toContain("home");

    await settle($rootScope, router.navigateByUrl("/admin/users"));

    expect(host.textContent).toContain("lazy users page");
    appRef.destroy();
  });

  it("una ruta lazy con param (:id) resuelve", async () => {
    const { host, appRef, router, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/admin/users/42"));
    expect(host.textContent).toContain("detail 42");
    appRef.destroy();
  });

  it("el canActivate de la ruta loadChildren guarda toda la rama", async () => {
    guardHits = 0;
    const { appRef, router, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/admin/users"));
    expect(guardHits).toBeGreaterThan(0);
    appRef.destroy();
  });
});
