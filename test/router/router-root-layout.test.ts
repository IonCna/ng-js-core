import "reflect-metadata";
import "zone.js";
import { afterEach, describe, expect, it } from "vitest";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootAt, RlAbout, RlHome, RlNotFound, RlRoot, RlShell, resetDom, settle } from "./root-layout/harness.ts";

/** Layout raíz `{ path: "", component: Shell, children }` — el patrón de shell de Angular. */

const routes: Routes = [
  {
    path: "",
    component: RlShell,
    children: [
      { path: "", component: RlHome },
      { path: "about", component: RlAbout },
      { path: "admin", loadChildren: () => import("./lazy-admin.module.ts").then((m) => m.AdminModule) },
      { path: "**", component: RlNotFound },
    ],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [RlRoot, RlShell, RlHome, RlAbout, RlNotFound],
})
class AppModule {}

afterEach(resetDom);

describe("ngjs-core/router — layout raíz con path vacío", () => {
  it("`/` renderiza el shell con el hijo índice", async () => {
    const { host, appRef } = await bootAt(AppModule, "/");
    expect(host.querySelector(".shell")).not.toBeNull();
    expect(host.textContent).toContain("home");
    appRef.destroy();
  });

  it("un hijo eager (`/about`) matchea por URL, dentro del shell", async () => {
    const { host, appRef } = await bootAt(AppModule, "/about");
    expect(host.querySelector(".shell")).not.toBeNull();
    expect(host.textContent).toContain("about");
    expect(host.querySelector("#about")?.getAttribute("href")).toBe("/about");
    appRef.destroy();
  });

  it("navegar entre hijos y a un módulo lazy hijo del shell", async () => {
    const { host, appRef, router, $rootScope } = await bootAt(AppModule, "/");
    await settle($rootScope, router.navigateByUrl("/admin/users/5"));
    expect(host.querySelector(".shell")).not.toBeNull();
    expect(host.textContent).toContain("admin user 5");

    await settle($rootScope, router.navigateByUrl("/"));
    expect(host.textContent).toContain("home");
    appRef.destroy();
  });

  it("el `**` hijo del shell atrapa las URLs desconocidas", async () => {
    const { host, appRef } = await bootAt(AppModule, "/no/existe");
    expect(host.querySelector(".shell")).not.toBeNull();
    expect(host.textContent).toContain("not found");
    appRef.destroy();
  });
});
