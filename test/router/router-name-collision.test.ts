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

@Component({ selector: "nc-one", template: "<h1>one</h1>" })
class NcOne {}

@Component({ selector: "nc-two", template: "<h1>two</h1>" })
class NcTwo {}

@Component({ selector: "nc-root", controllerAs: "$", template: "<router-outlet></router-outlet>" })
class NcRoot {}

// `"a/b"` y `"a.b"` sanitizan ambos a `"a_b"` — deben desambiguar sin romper el registro.
const routes: Routes = [
  { path: "a/b", component: NcOne },
  { path: "a.b", component: NcTwo },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [NcRoot, NcOne, NcTwo],
})
class AppModule {}

describe("ngjs-core/router — colisión de nombres derivados", () => {
  it("dos paths que sanitizan igual registran ambos estados", async () => {
    const host = document.createElement("nc-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const router = injector.get<Router>(Router.$name);

    await router.navigateByUrl("/a/b");
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("one");

    await router.navigateByUrl("/a.b");
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("two");

    appRef.destroy();
  });
});
