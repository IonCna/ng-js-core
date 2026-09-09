import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/**
 * Regresión: un `redirectTo` hacia una ruta con `canActivate` / `canMatch` se
 * perdía en la PRIMERA navegación — el hook `onBefore` devolvía siempre una
 * Promise (era `async`) y UI-Router descartaba la transición redirigida.
 * `runGuards` deja el hook síncrono cuando los guards no son async.
 */

@Injectable()
class Flag {
  ok = true;
}

@Component({ selector: "rg-root", template: "<ui-view></ui-view>" })
class RgRoot {}
@Component({ selector: "rg-home", template: "<h1>home</h1>" })
class RgHome {}
@Component({ selector: "rg-target", template: "<h2>target</h2>" })
class RgTarget {}

let appRef: { destroy(): void; injector: unknown } | undefined;

async function boot(targetGuard: "canActivate" | "canMatch") {
  const routes: Routes = [
    { path: "", component: RgHome },
    { path: "go", redirectTo: "target", pathMatch: "full" },
    {
      path: "target",
      component: RgTarget,
      ...(targetGuard === "canActivate"
        ? { canActivate: [() => inject(Flag).ok] }
        : { canMatch: [() => inject(Flag).ok] }),
    },
  ];

  @NgModule({
    imports: [CommonModule, RouterModule.forRoot(routes)],
    declarations: [RgRoot, RgHome, RgTarget],
    providers: [Flag],
  })
  class AppModule {}

  const host = document.createElement("rg-root");
  document.body.appendChild(host);
  appRef = await bootstrapApplication(AppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    host,
    router: injector.get<Router>(Router.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

afterEach(() => {
  appRef?.destroy();
  appRef = undefined;
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — redirectTo hacia una ruta con guard (primera navegación)", () => {
  it("redirect a una ruta con `canActivate` sync se completa", async () => {
    const { host, router, $rootScope } = await boot("canActivate");

    await router.navigateByUrl("/go");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(host.textContent).toContain("target");
  });

  it("redirect a una ruta con `canMatch` sync se completa", async () => {
    const { host, router, $rootScope } = await boot("canMatch");

    await router.navigateByUrl("/go");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(host.textContent).toContain("target");
  });
});
