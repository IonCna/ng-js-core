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
@Component({ selector: "cac-admin", controllerAs: "$", template: "<h2>admin</h2><router-outlet></router-outlet>" })
class CacAdmin {}
@Component({ selector: "cac-users", template: "<h3>users</h3>" })
class CacUsers {}
@Component({ selector: "cac-root", controllerAs: "$", template: "<router-outlet></router-outlet>" })
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

// --- routerLinkActive exact --------------------------------------------------

@Component({
  selector: "rla-root",
  controllerAs: "$",
  template:
    '<a id="ex" router-link="\'/shop\'" router-link-active="on" router-link-active-exact>shop</a>' +
    '<a id="px" router-link="\'/shop\'" router-link-active="on">shop2</a>' +
    "<router-outlet></router-outlet>",
})
class RlaRoot {}
@Component({ selector: "rla-shop", controllerAs: "$", template: "<h2>shop</h2><router-outlet></router-outlet>" })
class RlaShop {}
@Component({ selector: "rla-items", template: "<h3>items</h3>" })
class RlaItems {}

const rlaRoutes: Routes = [{ path: "shop", component: RlaShop, children: [{ path: "items", component: RlaItems }] }];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(rlaRoutes)],
  declarations: [RlaRoot, RlaShop, RlaItems],
})
class RlaAppModule {}

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

  it("routerLinkActive exact usa match exacto en vez de prefijo", async () => {
    const { host, appRef, injector, $rootScope } = await boot(RlaAppModule, "rla-root");
    const router = injector.get<Router>(Router.$name);

    $rootScope.$digest();
    await router.navigateByUrl("/shop/items");
    $rootScope.$digest();
    $rootScope.$digest();

    const exact = host.querySelector("#ex") as HTMLElement;
    const prefix = host.querySelector("#px") as HTMLElement;

    expect(host.textContent).toContain("items");
    expect(prefix.classList.contains("on")).toBe(true); // root es ancestro del estado activo
    expect(exact.classList.contains("on")).toBe(false); // pero no es el estado exacto

    appRef.destroy();
  });
});
