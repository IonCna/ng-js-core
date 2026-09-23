import "reflect-metadata";
import "zone.js";
import type { StateService } from "@uirouter/angularjs";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { NavigationError, Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/**
 * Apuntar a rutas de un módulo lazy **antes** de que cargue (en Angular todo esto
 * anda): links `ui-sref` (URL y nombre), `redirectTo`, `navigate`, `$state.go`.
 */

@Component({ selector: "lt-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class LtRoot {}

@Component({
  selector: "lt-home",
  template:
    "<h1>home</h1>" +
    "<a id='url' ui-sref='/admin/users/7' ui-sref-active='active'>url</a>" +
    "<a id='name' ui-sref='admin.users_id({id: 8})'>name</a>",
})
class LtHome {}

const routes: Routes = [
  { path: "", component: LtHome },
  { path: "go-admin", redirectTo: "/admin/users/9" },
  { path: "go-admin-root", redirectTo: "/admin" },
  { path: "admin", loadChildren: () => import("./lazy-admin.module.ts").then((m) => m.AdminModule) },
];

@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [LtRoot, LtHome] })
class AppModule {}

async function settle($rootScope: angular.IRootScopeService, nav?: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 25; i++) {
    if (!$rootScope.$$phase) $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await nav;
}

async function boot() {
  const host = document.createElement("lt-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(AppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
  const router = injector.get<Router>(Router.$name);
  const navigationErrors: unknown[] = [];
  const sub = router.events.subscribe((event) => {
    if (event instanceof NavigationError) navigationErrors.push(event.error);
  });
  appRef.onDestroy(() => sub.unsubscribe());
  // Rechazos de UI-Router por el param de límite de segmento del future state (ruido que no debe existir).
  const segmentRejections: string[] = [];
  injector
    .get<{ onError(criteria: object, cb: (t: { error(): { detail?: unknown } }) => void): void }>("$transitions")
    .onError({}, (transition) => {
      const detail = String(transition.error()?.detail ?? "");
      if (detail.includes("ngjsSegmentEnd")) segmentRejections.push(detail);
    });
  await settle($rootScope);
  return { host, appRef, injector, router, $rootScope, navigationErrors, segmentRejections };
}

function link(host: Element, id: string): HTMLAnchorElement {
  return host.querySelector(`#${id}`) as HTMLAnchorElement;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — rutas de un módulo lazy sin cargar", () => {
  it("ui-sref en forma URL: href correcto, el click navega y ui-sref-active funciona", async () => {
    const { host, appRef, $rootScope, navigationErrors } = await boot();
    expect(link(host, "url").getAttribute("href")).toBe("/admin/users/7");

    link(host, "url").click();
    await settle($rootScope);

    expect(host.textContent).toContain("admin user 7");
    expect(window.location.pathname).toBe("/admin/users/7");
    expect(navigationErrors).toEqual([]);
    appRef.destroy();
  });

  it("ui-sref por nombre: la intención sobre el link baja el chunk y deja el href listo", async () => {
    const { host, appRef, $rootScope, navigationErrors, segmentRejections } = await boot();
    // Sin cargar, UI-Router solo conoce el future state: el href apunta a la raíz del módulo.
    expect(link(host, "name").getAttribute("href")).not.toBe("/admin/users/8");

    link(host, "name").dispatchEvent(new MouseEvent("mouseenter"));
    await settle($rootScope);
    expect(link(host, "name").getAttribute("href")).toBe("/admin/users/8");

    link(host, "name").click();
    await settle($rootScope);
    expect(host.textContent).toContain("admin user 8");
    expect(navigationErrors).toEqual([]);
    expect(segmentRejections).toEqual([]);
    appRef.destroy();
  });

  it("redirectTo hacia un hijo de un módulo lazy sin cargar", async () => {
    const { host, appRef, router, $rootScope, navigationErrors } = await boot();
    await settle($rootScope, router.navigateByUrl("/go-admin"));

    expect(host.textContent).toContain("admin user 9");
    expect(window.location.pathname).toBe("/admin/users/9");
    expect(navigationErrors).toEqual([]);
    appRef.destroy();
  });

  it("redirectTo hacia la raíz de un módulo lazy: sin rechazos intermedios", async () => {
    const { host, appRef, router, $rootScope, navigationErrors, segmentRejections } = await boot();
    await settle($rootScope, router.navigateByUrl("/go-admin-root"));

    expect(host.textContent).toContain("hola admin");
    expect(navigationErrors).toEqual([]);
    expect(segmentRejections).toEqual([]);
    appRef.destroy();
  });

  it("$state.go / Router.navigate a un hijo lazy: sin rechazos intermedios", async () => {
    const { host, appRef, injector, router, $rootScope, navigationErrors, segmentRejections } = await boot();
    await settle($rootScope, injector.get<StateService>("$state").go("admin.users_id", { id: "11" }));
    expect(host.textContent).toContain("admin user 11");

    await settle($rootScope, router.navigate(["/admin", "users", "10"]));
    expect(host.textContent).toContain("admin user 10");
    expect(navigationErrors).toEqual([]);
    expect(segmentRejections).toEqual([]);
    appRef.destroy();
  });
  // Último: su `forRoot` pisa el `pathToName` global del archivo (mismos paths).
  it("ui-sref-active marca el link en forma URL cuando se está en su ruta lazy", async () => {
    @Component({
      selector: "lt-nav",
      template: "<a id='nav' ui-sref='/shell/admin/users/7' ui-sref-active='active'>nav</a><ui-view></ui-view>",
    })
    class LtNav {}

    const navRoutes: Routes = [
      { path: "", component: LtHome },
      {
        path: "shell",
        component: LtNav,
        children: [{ path: "admin", loadChildren: () => import("./lazy-admin.module.ts").then((m) => m.AdminModule) }],
      },
    ];
    @NgModule({ imports: [CommonModule, RouterModule.forRoot(navRoutes)], declarations: [LtRoot, LtHome, LtNav] })
    class NavAppModule {}

    const host = document.createElement("lt-root");
    document.body.appendChild(host);
    const appRef = await bootstrapApplication(NavAppModule, { hostElement: host });
    const $rootScope = (appRef.injector as angular.auto.IInjectorService).get<angular.IRootScopeService>("$rootScope");
    window.history.pushState(null, "", "/shell");
    await settle($rootScope);
    // Desde el layout, antes de cargar la rama: link lazy en forma URL.
    const $location = (appRef.injector as angular.auto.IInjectorService).get<angular.ILocationService>("$location");
    $location.url("/shell");
    await settle($rootScope);
    expect(link(host, "nav").getAttribute("href")).toBe("/shell/admin/users/7");

    link(host, "nav").click();
    await settle($rootScope);

    expect(host.textContent).toContain("admin user 7");
    expect(link(host, "nav").classList.contains("active")).toBe(true);
    appRef.destroy();
  });
});
