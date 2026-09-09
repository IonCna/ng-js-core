import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/**
 * Regresión: la ruta índice (`path: ""` en `forRoot`) con `loadComponent` no
 * renderizaba en `/` — `lazyLoadFor` capturaba el `url: ""` sin normalizar y
 * re-registraba el estado con esa URL, que no matchea la raíz. Ahora `forRoot`
 * (`isRoot`) le da `url: "/"` a la ruta índice desde el `translate`, así el lazy
 * la captura bien.
 */

@Component({ selector: "lzi-shell", controllerAs: "$", template: "<ui-view></ui-view>" })
class LziShell {}

let appRef: { destroy(): void; injector: unknown } | undefined;

afterEach(() => {
  appRef?.destroy();
  appRef = undefined;
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — loadComponent en la ruta índice", () => {
  it("renderiza en `/` el componente lazy de `path: \"\"`", async () => {
    const routes: Routes = [
      { path: "", pathMatch: "full", loadComponent: () => import("./lazy-page.component.ts") },
    ];

    @NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [LziShell], bootstrap: [LziShell] })
    class AppModule {}

    const host = document.createElement("div");
    document.body.appendChild(host);

    appRef = await bootstrapApplication(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    const deadline = Date.now() + 4000;
    while (!host.textContent?.includes("lazy loaded") && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
      if (!$rootScope.$$phase) $rootScope.$digest();
    }

    expect(host.textContent).toContain("lazy loaded");
  });
});
