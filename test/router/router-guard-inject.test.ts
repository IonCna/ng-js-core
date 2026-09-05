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

@Injectable()
class AuthService {
  allowed = false;
}

@Component({ selector: "gi-home", template: "<h1>home</h1>" })
class GiHome {}

@Component({ selector: "gi-secret", template: "<h1>secret</h1>" })
class GiSecret {}

@Component({ selector: "gi-root", controllerAs: "$", template: "<router-outlet></router-outlet>" })
class GiRoot {}

const routes: Routes = [
  { path: "", component: GiHome },
  {
    path: "secret",
    component: GiSecret,
    // guard funcional que INYECTA un servicio con `inject()` — como en Angular real.
    canActivate: [() => inject(AuthService).allowed],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [GiRoot, GiHome, GiSecret],
  providers: [AuthService],
})
class AppModule {}

describe("ngjs-core/router — guard funcional con inject()", () => {
  it("bloquea o deja pasar según el servicio inyectado en el guard", async () => {
    const host = document.createElement("gi-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const router = injector.get<Router>(Router.$name);
    const auth = injector.get<AuthService>("AuthService");

    $rootScope.$digest();
    expect(host.textContent).toContain("home");

    // allowed = false → el guard devuelve false → sigue en home
    expect(await router.navigateByUrl("/secret")).toBe(false);
    $rootScope.$digest();
    expect(host.textContent).toContain("home");

    // allowed = true → pasa
    auth.allowed = true;
    expect(await router.navigateByUrl("/secret")).toBe(true);
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("secret");

    appRef.destroy();
  });
});
