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

@Component({ selector: "t2-dash", template: "<h1>dashboard</h1>" })
class DashPage {}

@Component({ selector: "t2-profile", controllerAs: "$", template: "<h1>profile {{ $.id }}</h1>" })
class ProfilePage {
  static readonly $inject = [ActivatedRoute.$name];
  id = "";
  title = "";
  constructor(route: ActivatedRoute) {
    route.paramMap.subscribe((m) => {
      this.id = m.get("id") ?? "";
    });
    route.title.subscribe((t) => {
      this.title = t;
    });
  }
}

@Component({ selector: "t2-404", template: "<h1>not found</h1>" })
class NotFoundPage {}

@Component({ selector: "t2-root", controllerAs: "$", template: "<router-outlet></router-outlet>" })
class T2Root {}

const routes: Routes = [
  { path: "", redirectTo: "dashboard", pathMatch: "full" },
  { path: "dashboard", component: DashPage, title: "Dashboard" },
  { path: "profile/:id", component: ProfilePage, title: (s) => `Profile ${s.params.id}` },
  { path: "**", component: NotFoundPage },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [T2Root, DashPage, ProfilePage, NotFoundPage],
})
class AppModule {}

describe("ngjs-core/router — Tier 2", () => {
  it("redirectTo, Route.title (string + fn), y path '**'", async () => {
    const host = document.createElement("t2-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const router = injector.get<Router>(Router.$name);
    const activatedRoute = injector.get<ActivatedRoute>(ActivatedRoute.$name);
    let lastTitle = "";
    activatedRoute.title.subscribe((t) => {
      lastTitle = t;
    });

    // initial `/` → redirectTo "dashboard"
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("dashboard");
    expect(document.title).toBe("Dashboard");

    // title como función
    await router.navigateByUrl("/profile/9");
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("profile 9");
    expect(document.title).toBe("Profile 9");
    expect(lastTitle).toBe("Profile 9");

    // ruta desconocida → wildcard
    await router.navigateByUrl("/nope/nope");
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("not found");

    appRef.destroy();
  });
});
