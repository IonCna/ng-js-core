import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { ActivatedRoute, Router, RouterModule, TitleStrategy } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

// --- componentes --------------------------------------------------------------

@Component({ selector: "fc-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class FcRoot {}
@Component({ selector: "fc-home", template: "<h1>home</h1>" })
class FcHome {}
@Component({ selector: "fc-plain", template: "<h2>plain</h2>" })
class FeaturePlain {}
@Component({ selector: "fc-list", template: "<h2>list</h2>" })
class FeatureList {}
@Component({ selector: "fc-detail", controllerAs: "$", template: "<h2>detail</h2>" })
class FeatureDetail {}

// --- estado observable para los guards -------------------------------------

@Injectable()
class FeatureState {
  canLeave = true;
  canEnter = true;
  appliedTitles: (string | undefined)[] = [];
}

class TitleStrategyWithState extends TitleStrategy {
  static readonly $inject = ["FeatureState"] as const;
  constructor(private readonly state: FeatureState) {
    super();
  }
  updateTitle(title: string | undefined): void {
    this.state.appliedTitles.push(title);
    document.title = title ?? "";
  }
}

// --- árboles: forRoot (home + redirect) / forChild (feature) ---------------

const rootRoutes: Routes = [
  { path: "", component: FcHome },
  // redirect CRUZADO: apunta a un path (con `canMatch`) que registra el `forChild`.
  { path: "go-feature", redirectTo: "feature/list", pathMatch: "full" },
];

const featureRoutes: Routes = [
  { path: "feature/plain", component: FeaturePlain, title: "Feature plain" },
  {
    path: "feature/list",
    component: FeatureList,
    title: "Feature list",
    canMatch: [() => inject(FeatureState).canEnter],
  },
  {
    path: "feature/detail",
    component: FeatureDetail,
    title: (s) => `Detail ${s.data.kind}`,
    data: { kind: "x" },
    canDeactivate: [() => inject(FeatureState).canLeave],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(rootRoutes), RouterModule.forChild(featureRoutes)],
  declarations: [FcRoot, FcHome, FeaturePlain, FeatureList, FeatureDetail],
  providers: [FeatureState, { provide: TitleStrategy, useClass: TitleStrategyWithState }],
})
class FcAppModule {}

let appRef: { destroy(): void; injector: unknown } | undefined;

async function boot() {
  const host = document.createElement("fc-root");
  document.body.appendChild(host);
  appRef = await bootstrapApplication(FcAppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    host,
    injector,
    router: injector.get<Router>(Router.$name),
    state: injector.get<FeatureState>("FeatureState"),
    route: injector.get<ActivatedRoute>(ActivatedRoute.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

afterEach(() => {
  appRef?.destroy();
  appRef = undefined;
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — forChild se acerca a Angular (title / canDeactivate / canMatch / redirect cruzado)", () => {
  it("el `title` de una ruta de forChild actualiza el título (lo veía solo forRoot antes)", async () => {
    const { router, state, $rootScope } = await boot();

    await router.navigateByUrl("/feature/plain");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(state.appliedTitles).toContain("Feature plain");
    expect(document.title).toBe("Feature plain");
  });

  it("la `data` resuelta llega a la ResolveFn de `title` y a ActivatedRoute.data en rutas de forChild", async () => {
    const { router, route, $rootScope } = await boot();

    await router.navigateByUrl("/feature/detail");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(document.title).toBe("Detail x");

    const data = await new Promise<Record<string, unknown>>((resolve) => {
      route.data.subscribe((d) => resolve(d));
    });
    expect(data.kind).toBe("x");
  });

  it("`canDeactivate` de una ruta de forChild bloquea la salida", async () => {
    const { host, router, state, $rootScope } = await boot();

    expect(await router.navigateByUrl("/feature/detail")).toBe(true);
    $rootScope.$digest();
    expect(host.textContent).toContain("detail");

    state.canLeave = false;
    expect(await router.navigateByUrl("/")).toBe(false);
    $rootScope.$digest();
    expect(host.textContent).toContain("detail");

    state.canLeave = true;
    expect(await router.navigateByUrl("/")).toBe(true);
    $rootScope.$digest();
    expect(host.textContent).toContain("home");
  });

  it("`canMatch` de una ruta de forChild aborta la transición cuando devuelve false", async () => {
    const { host, router, state, $rootScope } = await boot();

    state.canEnter = false;
    expect(await router.navigateByUrl("/feature/list")).toBe(false);
    $rootScope.$digest();
    expect(host.textContent).not.toContain("list");

    state.canEnter = true;
    expect(await router.navigateByUrl("/feature/list")).toBe(true);
    $rootScope.$digest();
    $rootScope.$digest();
    expect(host.textContent).toContain("list");
  });

  it("`redirectTo` cruzado: una ruta de forRoot redirige a un path (con canMatch) de forChild", async () => {
    const { host, router, $rootScope } = await boot();

    // el redirect supersede la transición original (navigateByUrl → false);
    // lo que importa es que termina montando la ruta destino de forChild,
    // incluso teniendo `canMatch` (un `onBefore` async ahí rompía el redirect).
    await router.navigateByUrl("/go-feature");
    $rootScope.$digest();
    $rootScope.$digest();

    expect(host.textContent).toContain("list");
  });

  it("llamar RouterModule.forRoot() dos veces en la misma app lanza el guard", async () => {
    @NgModule({
      imports: [CommonModule, RouterModule.forRoot([]), RouterModule.forRoot([])],
      declarations: [FcRoot],
    })
    class TwiceModule {}

    const host = document.createElement("fc-root");
    document.body.appendChild(host);

    await expect(bootstrapApplication(TwiceModule, { hostElement: host })).rejects.toThrow(
      /forRoot\(\) se llamó dos veces/,
    );
  });
});
