import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/** `Route.providers`: entorno de DI por ruta (Angular: `route._injector`). */

const log: string[] = [];

@Component({ selector: "rp-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class RpRoot {}

@Component({ selector: "rp-home", controllerAs: "$ctrl", template: "<p class='home'>{{ $ctrl.text }}</p>" })
class RpHome {
  static readonly $inject = ["$injector"];
  text: string;
  constructor($injector: angular.auto.IInjectorService) {
    this.text = $injector.has("Tenant") ? "leak" : "no-tenant";
  }
}

/** Mismo componente en dos rutas con distintos `providers`. */
@Component({ selector: "rp-tenant", controllerAs: "$ctrl", template: "<p class='tenant'>{{ $ctrl.tenant }}</p>" })
class RpTenant {
  static readonly $inject = ["Tenant"];
  constructor(readonly tenant: string) {}
}

@Component({
  selector: "rp-layout",
  controllerAs: "$ctrl",
  template: "<h2 class='layout'>{{ $ctrl.tenant }}</h2><ui-view></ui-view>",
})
class RpLayout {
  tenant = inject<string>("Tenant");
}

const routes: Routes = [
  { path: "", component: RpHome },
  { path: "acme", component: RpTenant, providers: [{ provide: "Tenant", useValue: "acme" }] },
  { path: "globex", component: RpTenant, providers: [{ provide: "Tenant", useValue: "globex" }] },
  {
    path: "org",
    component: RpLayout,
    providers: [{ provide: "Tenant", useValue: "org" }],
    canActivate: [
      () => {
        log.push(`guard:${inject<string>("Tenant")}`);
        return true;
      },
    ],
    resolve: { tenant: () => log.push(`resolve:${inject<string>("Tenant")}`) },
    children: [
      { path: "team", component: RpTenant },
      { path: "lazy", loadChildren: () => import("./lazy-route-providers.module.ts").then((m) => m.RpLazyModule) },
    ],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [RpRoot, RpHome, RpTenant, RpLayout],
})
class AppModule {}

async function boot() {
  const host = document.createElement("rp-root");
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

async function settle($rootScope: angular.IRootScopeService, nav?: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (!$rootScope.$$phase) $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await nav;
}

afterEach(() => {
  log.length = 0;
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — Route.providers", () => {
  it("el mismo componente recibe el provider de la ruta que lo renderiza", async () => {
    const { host, appRef, router, injector, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/acme"));
    expect(host.querySelector(".tenant")?.textContent).toBe("acme");

    await settle($rootScope, router.navigateByUrl("/globex"));
    expect(host.querySelector(".tenant")?.textContent).toBe("globex");

    await settle($rootScope, router.navigateByUrl("/"));
    expect(host.querySelector(".home")?.textContent).toBe("no-tenant");
    expect(injector.has("Tenant")).toBe(false);
    appRef.destroy();
  });

  it("los hijos heredan los providers de la ruta; guards y resolvers los ven con inject()", async () => {
    const { host, appRef, router, $rootScope } = await boot();
    // Directo a `/org`: su `canActivate` solo corre con la ruta como destino (no al ir a un hijo).
    await settle($rootScope, router.navigateByUrl("/org"));
    expect(log).toEqual(expect.arrayContaining(["guard:org", "resolve:org"]));

    await settle($rootScope, router.navigateByUrl("/org/team"));
    expect(host.querySelector(".layout")?.textContent).toBe("org");
    expect(host.querySelector(".tenant")?.textContent).toBe("org");
    appRef.destroy();
  });

  it("un módulo lazy bajo una ruta con providers: su injector es hijo del de la ruta", async () => {
    const { host, appRef, router, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/org/lazy"));
    expect(host.querySelector(".lazy-rp")?.textContent).toBe("org/lazy-only");
    appRef.destroy();
  });
});
