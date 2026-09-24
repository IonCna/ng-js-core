import { afterEach, describe, expect, it } from "vitest";
import { RouterApp } from "./router-app.ts";

/** Porta de `old/test/router/router.test.ts` (etapa 16). */
describe("ngjs-core/router — etapa 16 (código compilado)", () => {
  let app: RouterApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("navega entre 2 rutas, corre guard + resolve, y ActivatedRoute.paramMap emite", async () => {
    app = await RouterApp.boot({
      "app.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
import { ActivatedRoute, RouterModule, type Routes } from "ngjs-core/router";

export const calls: string[] = [];
(globalThis as any).calls = calls;

@Component({ selector: "home-page", template: "<h1>home</h1>" })
export class HomePage {}

@Component({ selector: "about-page", template: "<h1>about {{ $ctrl.id }}</h1>" })
export class AboutPage {
  id = "";
  constructor(route: ActivatedRoute) { route.paramMap.subscribe((map) => (this.id = map.get("id") ?? "")); }
}

@Component({ selector: "app-root", template: "<ui-view></ui-view>" })
export class AppRoot {}

const routes: Routes = [
  { path: "", component: HomePage },
  {
    path: "about/:id",
    component: AboutPage,
    canActivate: [() => { calls.push("guard"); return true; }],
    resolve: { seed: () => { calls.push("resolve"); return 7; } },
  },
];

@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, HomePage, AboutPage], bootstrap: [AppRoot] })
export class AppModule {}
`,
    });
    expect(app.text).toContain("home");

    await app.navigate("/about/42");
    expect(app.text).toContain("about 42");
    expect(app.app.global<string[]>("calls")).toEqual(["guard", "resolve"]);
  });
});
