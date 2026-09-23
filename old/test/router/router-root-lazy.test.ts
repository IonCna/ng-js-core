import "reflect-metadata";
import "zone.js";
import { afterEach, describe, expect, it } from "vitest";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootAt, RlAbout, RlRoot, resetDom } from "./root-layout/harness.ts";

/** Módulo lazy montado en la raíz (`{ path: "", loadChildren }`) con un hermano eager. */

const routes: Routes = [
  { path: "about", component: RlAbout },
  { path: "", loadChildren: () => import("./lazy-admin.module.ts").then((m) => m.AdminModule) },
];

@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [RlRoot, RlAbout] })
class AppModule {}

afterEach(resetDom);

describe("ngjs-core/router — módulo lazy en la raíz", () => {
  it("`/` carga el módulo y muestra su índice", async () => {
    const { host, appRef } = await bootAt(AppModule, "/");
    expect(host.textContent).toContain("hola admin");
    appRef.destroy();
  });

  it("una ruta del módulo lazy (`/users/3`) resuelve sin prefijo", async () => {
    const { host, appRef } = await bootAt(AppModule, "/users/3");
    expect(host.textContent).toContain("admin user 3");
    appRef.destroy();
  });

  it("el hermano eager (`/about`) no queda tapado por el módulo lazy de la raíz", async () => {
    const { host, appRef } = await bootAt(AppModule, "/about");
    expect(host.textContent).toContain("about");
    appRef.destroy();
  });
});
