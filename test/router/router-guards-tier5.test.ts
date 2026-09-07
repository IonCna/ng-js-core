import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

@Component({ selector: "t5-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class T5Root {}

@Component({ selector: "t5-home", template: "<h1>home</h1>" })
class T5Home {}

@Component({ selector: "t5-editor", controllerAs: "$", template: "<h1>editor</h1>" })
class T5Editor {
  dirty = true;
}

@Component({ selector: "t5-flagged", template: "<h1>flagged</h1>" })
class T5Flagged {}

@Component({ selector: "t5-nf", template: "<h1>not found</h1>" })
class T5NotFound {}

let allowMatch = false;
let deactivateArgs: unknown[] | undefined;

const routes: Routes = [
  { path: "", component: T5Home },
  {
    path: "editor/:id",
    component: T5Editor,
    data: { role: "editor" },
    canDeactivate: [
      (component, currentRoute, currentState, nextState) => {
        deactivateArgs = [component, currentRoute, currentState, nextState];
        return !(component as T5Editor)?.dirty;
      },
    ],
  },
  { path: "flagged", component: T5Flagged, canMatch: [() => allowMatch] },
  { path: "**", component: T5NotFound },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [T5Root, T5Home, T5Editor, T5Flagged, T5NotFound],
})
class AppModule {}

let currentAppRef: { destroy(): void } | undefined;

async function boot() {
  const host = document.createElement("t5-root");
  document.body.appendChild(host);
  const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
  currentAppRef = appRef;
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    host,
    router: injector.get<Router>(Router.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

async function nav($rootScope: angular.IRootScopeService, promise: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 12; i++) {
    $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await promise.catch(() => undefined);
}

afterEach(() => {
  currentAppRef?.destroy();
  currentAppRef = undefined;
  allowMatch = false;
  deactivateArgs = undefined;
});

describe("ngjs-core/router — CanMatch / CanDeactivate", () => {
  it("canMatch false → bloquea la navegación; true → matchea", async () => {
    const { host, router, $rootScope } = await boot();

    await nav($rootScope, router.navigateByUrl("/flagged"));
    expect(host.textContent).toContain("home"); // abortó: se queda donde estaba

    allowMatch = true;
    await nav($rootScope, router.navigateByUrl("/flagged"));
    expect(host.textContent).toContain("flagged");
  });

  it("canDeactivate false bloquea la salida; recibe la firma completa de Angular", async () => {
    const { host, router, $rootScope } = await boot();

    await nav($rootScope, router.navigateByUrl("/editor/42"));
    expect(host.textContent).toContain("editor");

    // dirty = true → el guard devuelve false → no navega
    await nav($rootScope, router.navigateByUrl("/"));
    expect(host.textContent).toContain("editor");

    const [component, currentRoute, currentState, nextState] = deactivateArgs as [
      unknown,
      { params: Record<string, string>; data: Record<string, unknown> },
      { url: string; root: { params: Record<string, string> } },
      { url: string },
    ];
    expect(component).toBeInstanceOf(T5Editor);
    expect(currentRoute.params.id).toBe("42");
    expect(currentRoute.data.role).toBe("editor");
    expect(currentState.url).toContain("/editor/42");
    expect(currentState.root.params.id).toBe("42");
    expect(nextState.url).toBe("/");

    // limpiar el flag en la instancia real que recibió el guard → ahora deja salir
    (component as T5Editor).dirty = false;
    await nav($rootScope, router.navigateByUrl("/"));
    expect(host.textContent).toContain("home");
  });
});
