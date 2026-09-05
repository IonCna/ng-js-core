import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

@Component({ selector: "t3l-home", template: "<h1>home</h1>" })
class HomeL {}

@Component({ selector: "t3l-page", template: "<h1>page</h1>" })
class PageL {}

@Component({
  selector: "t3l-root",
  controllerAs: "$",
  template: '<a id="lnk" router-link="[\'/page\', 3]" router-link-active="act">go</a><router-outlet></router-outlet>',
})
class RootL {}

const routes: Routes = [
  { path: "", component: HomeL },
  { path: "page/:n", component: PageL },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [RootL, HomeL, PageL],
})
class AppModule {}

describe("ngjs-core/router — Tier 3: routerLink / routerLinkActive", () => {
  it("arma href, navega al click, y togglea la clase activa", async () => {
    const host = document.createElement("t3l-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    $rootScope.$digest();
    const link = host.querySelector("#lnk") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBeTruthy();
    expect(link.getAttribute("href")).toContain("/page/3");
    expect(link.classList.contains("act")).toBe(false);
    expect(host.textContent).toContain("home");

    angular.element(link).triggerHandler("click");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(host.textContent).toContain("page");
    expect(link.classList.contains("act")).toBe(true);

    appRef.destroy();
  });
});
