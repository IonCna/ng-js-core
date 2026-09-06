import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

async function boot(AppModule: Function, tag: string) {
  const host = document.createElement(tag);
  document.body.appendChild(host);
  const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  return { host, appRef, injector, $rootScope: injector.get<angular.IRootScopeService>("$rootScope") };
}

// --- canActivateChild -----------------------------------------------------

@Injectable()
class Gate {
  open = false;
}

@Component({ selector: "cac-home", template: "<h1>home</h1>" })
class CacHome {}
@Component({ selector: "cac-admin", controllerAs: "$", template: "<h2>admin</h2><ui-view></ui-view>" })
class CacAdmin {}
@Component({ selector: "cac-users", template: "<h3>users</h3>" })
class CacUsers {}
@Component({ selector: "cac-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class CacRoot {}

const cacRoutes: Routes = [
  { path: "", component: CacHome },
  {
    path: "admin",
    component: CacAdmin,
    canActivateChild: [() => inject(Gate).open],
    children: [{ path: "users", component: CacUsers }],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(cacRoutes)],
  declarations: [CacRoot, CacHome, CacAdmin, CacUsers],
  providers: [Gate],
})
class CacAppModule {}

describe("ngjs-core/router — Tier 4", () => {
  it("canActivateChild protege los hijos pero no el padre, e inyecta servicios", async () => {
    const { host, appRef, injector, $rootScope } = await boot(CacAppModule, "cac-root");
    const router = injector.get<Router>(Router.$name);
    const gate = injector.get<Gate>("Gate");

    $rootScope.$digest();
    $rootScope.$digest();

    // el padre `admin` no dispara canActivateChild → entra aunque Gate esté cerrado
    expect(await router.navigateByUrl("/admin")).toBe(true);
    $rootScope.$digest();
    expect(host.textContent).toContain("admin");
    expect(host.textContent).not.toContain("users");

    // hijo bloqueado
    expect(await router.navigateByUrl("/admin/users")).toBe(false);
    $rootScope.$digest();
    expect(host.textContent).not.toContain("users");

    // hijo permitido
    gate.open = true;
    expect(await router.navigateByUrl("/admin/users")).toBe(true);
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("users");

    appRef.destroy();
  });
});
