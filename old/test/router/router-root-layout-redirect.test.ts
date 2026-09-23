import "reflect-metadata";
import "zone.js";
import { afterEach, describe, expect, it } from "vitest";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootAt, RlAbout, RlRoot, RlShell, resetDom } from "./root-layout/harness.ts";

const routes: Routes = [
  {
    path: "",
    component: RlShell,
    children: [
      { path: "", pathMatch: "full", redirectTo: "about" },
      { path: "about", component: RlAbout },
    ],
  },
];

@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [RlRoot, RlShell, RlAbout] })
class AppModule {}

afterEach(resetDom);

describe("ngjs-core/router — layout raíz con redirect índice", () => {
  it("`/` redirige al hijo, dentro del shell", async () => {
    const { host, appRef } = await bootAt(AppModule, "/");
    expect(window.location.pathname).toBe("/about");
    expect(host.querySelector(".shell")).not.toBeNull();
    expect(host.textContent).toContain("about");
    appRef.destroy();
  });
});
