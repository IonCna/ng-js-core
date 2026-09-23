import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { ActivatedRoute, Router, RouterModule, withRouterConfig } from "@/router/index.ts";
import { mergeStaticData } from "@/router/route-title.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "pi-home", template: "<h1>home</h1>" })
class HomePi {}

@Component({ selector: "pi-leaf", template: "<h1>leaf</h1>" })
class LeafPi {}

@Component({ selector: "pi-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class RootPi {}

function makeRoutes(): Routes {
  return [
    { path: "", component: HomePi },
    {
      // Padre con URL propia (no vacía) — como `components/nav` en ngbjs-doc.
      path: "parent",
      data: { title: "Parent", tabs: ["a", "b"] },
      children: [{ path: "leaf", component: LeafPi, data: { sections: ["s1"] } }],
    },
  ];
}

async function bootstrap(routes: Routes, strategy?: "always") {
  @NgModule({
    imports: [
      CommonModule,
      RouterModule.forRoot(routes, ...(strategy ? [withRouterConfig({ paramsInheritanceStrategy: strategy })] : [])),
    ],
    declarations: [RootPi, HomePi, LeafPi],
  })
  class AppModule {}

  const host = document.createElement("pi-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(AppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
  const route = injector.get<ActivatedRoute>(ActivatedRoute.$name);
  const router = injector.get<Router>(Router.$name);
  return { appRef, $rootScope, route, router };
}

describe("ngjs-core/router — paramsInheritanceStrategy (integración vía RouterModule.forRoot)", () => {
  it("'emptyOnly' (default): NO hereda data del padre con path propio no vacío", async () => {
    const { appRef, $rootScope, route, router } = await bootstrap(makeRoutes());
    let data: Record<string, unknown> = {};
    route.data.subscribe((d) => {
      data = d;
    });
    $rootScope.$digest();

    await router.navigateByUrl("/parent/leaf");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(data.sections).toEqual(["s1"]);
    expect(data.title).toBeUndefined();
    expect(data.tabs).toBeUndefined();

    appRef.destroy();
  });

  it("'always': hereda data de toda la cadena, incluso con path propio no vacío", async () => {
    const { appRef, $rootScope, route, router } = await bootstrap(makeRoutes(), "always");
    let data: Record<string, unknown> = {};
    route.data.subscribe((d) => {
      data = d;
    });
    $rootScope.$digest();

    await router.navigateByUrl("/parent/leaf");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(data.sections).toEqual(["s1"]);
    expect(data.title).toBe("Parent");
    expect(data.tabs).toEqual(["a", "b"]);

    appRef.destroy();
  });
});

describe("ngjs-core/router — mergeStaticData (unidad)", () => {
  const chain = [
    { name: "group", data: { shell: true } },
    { name: "group.wrapper", data: { own: 1 } },
  ];

  it("'always': mergea toda la cadena, el más profundo gana en choques", () => {
    const merged = mergeStaticData(
      [
        { name: "a", data: { x: 1, shared: "a" } },
        { name: "a.b", data: { y: 2, shared: "b" } },
      ],
      new Set(),
      "always",
    );
    expect(merged).toEqual({ x: 1, y: 2, shared: "b" });
  });

  it("'emptyOnly': no hereda si la hoja tiene path propio (no está en emptyPathStates)", () => {
    const merged = mergeStaticData(chain, new Set(), "emptyOnly");
    expect(merged).toEqual({ own: 1 });
  });

  it("'emptyOnly': hereda del padre mientras la hoja (y cada ancestro subido) tenga path vacío", () => {
    const merged = mergeStaticData(chain, new Set(["group.wrapper"]), "emptyOnly");
    expect(merged).toEqual({ shell: true, own: 1 });
  });

  it("'emptyOnly': corta la herencia en el primer ancestro con path propio no vacío", () => {
    const threeDeep = [
      { name: "root", data: { r: 1 } },
      { name: "root.mid", data: { m: 1 } }, // path propio no vacío — no está en emptyPathStates
      { name: "root.mid.leaf", data: { l: 1 } },
    ];
    // Ni "root.mid.leaf" ni "root.mid" son empty-path → no hereda nada de "root".
    const merged = mergeStaticData(threeDeep, new Set(), "emptyOnly");
    expect(merged).toEqual({ l: 1 });
  });
});
