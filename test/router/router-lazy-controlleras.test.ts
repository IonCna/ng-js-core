import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule } from "@/router/index.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/**
 * Un componente de ruta lazy (`loadComponent`) no está en ningún `@NgModule`, así
 * que no hereda `controllerAs`. `routerRegistry` guarda el `controllerAs` del
 * `@NgModule` que importa el `RouterModule` y `lazyLoadFor` lo usa de fallback.
 */

@Component({ selector: "lcas-shell", controllerAs: "$", template: "<ui-view></ui-view>" })
class LcasShell {}

let appRef: { destroy(): void; injector: unknown } | undefined;

afterEach(() => {
  appRef?.destroy();
  appRef = undefined;
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
  routerRegistry.reset();
});

describe("ngjs-core/router — controllerAs heredado en componente lazy", () => {
  it("el componente lazy sin controllerAs propio usa el del @NgModule que importa el router", async () => {
    const routes: Routes = [
      { path: "", pathMatch: "full", loadComponent: () => import("./lazy-controlleras.component.ts") },
    ];

    @NgModule({
      id: "lcas-app",
      controllerAs: "$",
      imports: [CommonModule, RouterModule.forRoot(routes)],
      declarations: [LcasShell],
      bootstrap: [LcasShell],
    })
    class AppModule {}

    const host = document.createElement("div");
    document.body.appendChild(host);

    appRef = await bootstrapApplication(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    // el chunk lazy resuelve async (import() + re-registro + retry de UI-Router):
    // digerir en loop hasta que monte, sin depender de un setTimeout fijo.
    const deadline = Date.now() + 4000;
    while (!host.textContent?.includes("cas-ok") && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
      if (!$rootScope.$$phase) $rootScope.$digest();
    }

    expect(host.textContent).toContain("cas-ok");
  });
});
