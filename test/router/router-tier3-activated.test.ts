import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { RouterEvent, Routes } from "@/router/index.ts";
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

@Component({ selector: "t3a-home", template: "<h1>home</h1>" })
class HomeT3 {}

@Component({ selector: "t3a-item", template: "<h1>item</h1>" })
class ItemT3 {}

@Component({ selector: "t3a-root", controllerAs: "$", template: "<router-outlet></router-outlet>" })
class RootT3 {}

const routes: Routes = [
  { path: "", component: HomeT3 },
  { path: "item/:id", component: ItemT3, resolve: { detail: (s) => `D:${s.params.id}` } },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [RootT3, HomeT3, ItemT3],
})
class AppModule {}

describe("ngjs-core/router — Tier 3: ActivatedRoute + Router.events", () => {
  it("queryParamMap, fragment, resolved data, y eventos de navegación", async () => {
    const host = document.createElement("t3a-root");
    document.body.appendChild(host);

    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const router = injector.get<Router>(Router.$name);
    const route = injector.get<ActivatedRoute>(ActivatedRoute.$name);

    const events: string[] = [];
    router.events.subscribe((e: RouterEvent) => {
      if (e instanceof NavigationStart) events.push(`start:${e.url}`);
      if (e instanceof NavigationEnd) events.push("end");
    });

    let id = "";
    let tab = "";
    let frag: string | null = null;
    let detail: unknown;
    route.paramMap.subscribe((m) => {
      id = m.get("id") ?? "";
    });
    route.queryParamMap.subscribe((m) => {
      tab = m.get("tab") ?? "";
    });
    route.fragment.subscribe((f) => {
      frag = f;
    });
    route.data.subscribe((d) => {
      detail = d.detail;
    });

    $rootScope.$digest();

    await router.navigateByUrl("/item/5?tab=info#sec");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(id).toBe("5");
    expect(tab).toBe("info");
    expect(frag).toBe("sec");
    expect(detail).toBe("D:5");
    expect(route.snapshot.queryParams?.tab).toBe("info");
    expect(events.some((e) => e.startsWith("start:"))).toBe(true);
    expect(events).toContain("end");

    appRef.destroy();
  });
});
