import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { ActivatedRoute, Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

const guardCalls: string[] = [];
const resolveCalls: string[] = [];

@Component({ selector: "home-page", template: "<h1>home</h1>" })
class HomePage {}

@Component({ selector: "about-page", controllerAs: "$", template: "<h1>about {{ $.id }}</h1>" })
class AboutPage {
  static readonly $inject = [ActivatedRoute.$name];
  id = "";
  constructor(route: ActivatedRoute) {
    route.paramMap.subscribe((map) => {
      this.id = map.get("id") ?? "";
    });
  }
}

@Component({ selector: "app-root", controllerAs: "$", template: "<router-outlet></router-outlet>" })
class AppRoot {}

const routes: Routes = [
  { path: "", component: HomePage },
  {
    path: "about/:id",
    component: AboutPage,
    canActivate: [
      () => {
        guardCalls.push("about");
        return true;
      },
    ],
    resolve: {
      seed: () => {
        resolveCalls.push("seed");
        return 7;
      },
    },
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [AppRoot, HomePage, AboutPage],
})
class AppModule {}

describe("ngjs-core/router — etapa 16", () => {
  it("navega entre 2 rutas, corre guard + resolve, y ActivatedRoute.paramMap emite", async () => {
    const host = document.createElement("app-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    $rootScope.$digest();
    expect(host.textContent).toContain("home");

    const router = injector.get<Router>(Router.$name);
    await router.navigateByUrl("/about/42");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(host.textContent).toContain("about 42");
    expect(guardCalls).toContain("about");
    expect(resolveCalls).toContain("seed");

    appRef.destroy();
  });
});
