import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

@Component({ selector: "shell-page", template: "<h1>shell</h1>" })
class ShellPage {}

@Component({ selector: "lazy-root", controllerAs: "$", template: "<router-outlet></router-outlet>" })
class LazyRoot {}

const routes: Routes = [
  { path: "", component: ShellPage },
  { path: "lazy", loadComponent: () => import("./lazy-page.component.ts") },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [LazyRoot, ShellPage],
})
class AppModule {}

describe("ngjs-core/router — loadComponent lazy", () => {
  it("carga el chunk con import() nativo y monta el componente", async () => {
    const host = document.createElement("lazy-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");

    $rootScope.$digest();
    expect(host.textContent).toContain("shell");

    await injector.get<Router>(Router.$name).navigateByUrl("/lazy");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(host.textContent).toContain("lazy loaded");

    appRef.destroy();
  });
});
