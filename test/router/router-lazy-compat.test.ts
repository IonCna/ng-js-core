import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { bootstrap, component } from "@/compat/index.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";

// Autoría JS plana (forma funcional que auto-registra) — sin compilador.
class CompatRoot {}
component(CompatRoot).define({ selector: "compat-root", controllerAs: "$", template: "<ui-view></ui-view>" });

class CompatHome {}
component(CompatHome).define({ selector: "compat-home", template: "<h1>compat home</h1>" });

const routes: Routes = [
  { path: "", component: CompatHome },
  { path: "admin", loadChildren: () => import("./lazy-children.compat.js").then((m) => m.CHILD_ROUTES) },
];

async function settle($rootScope: angular.IRootScopeService, nav: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 20; i++) {
    $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await nav;
}

describe("ngjs-core/compat — router + loadChildren, sin compilador", () => {
  it("import() nativo de un .js plano baja el chunk y monta el componente", async () => {
    const host = document.createElement("compat-root");
    document.body.appendChild(host);

    const appRef = await bootstrap(host, { imports: [RouterModule.forRoot(routes)] });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const router = injector.get<Router>(Router.$name);

    $rootScope.$digest();
    expect(host.textContent).toContain("compat home");

    await settle($rootScope, router.navigateByUrl("/admin/users"));
    expect(host.textContent).toContain("compat lazy users");

    appRef.destroy();
  });
});
