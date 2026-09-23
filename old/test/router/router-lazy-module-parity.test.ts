import "reflect-metadata";
import "zone.js";
import type { StateService, TransitionService } from "@uirouter/angularjs";
import type angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule, ngModuleInjectionName } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";
import { destroyLog, Greeting, GreetingLabel, routeLog } from "./env-shared.ts";
import { CoreModule, moduleLog } from "./lazy-core.module.ts";
import { SharedRoutesModule } from "./lazy-shared.module.ts";

/** Paridad con Angular de `loadChildren` → `@NgModule` (brechas cerradas una por una). */

@Component({ selector: "lp-root", controllerAs: "$", template: "<ui-view></ui-view>" })
class LpRoot {}

@Component({ selector: "lp-home", template: "<h1>home</h1><greeting-label></greeting-label>" })
class LpHome {}

const routes: Routes = [
  { path: "", component: LpHome },
  { path: "admin", loadChildren: () => import("./lazy-admin.module.ts").then((m) => m.AdminModule) },
  {
    path: "env",
    // Guard de la propia ruta `loadChildren`: corre en el injector del padre (la app), no en el de la rama.
    canActivate: [
      () => {
        routeLog.push(`lazyRoute:${inject<Greeting>("Greeting").text}`);
        return true;
      },
    ],
    loadChildren: () => import("./lazy-env.module.ts").then((m) => m.EnvModule),
  },
  { path: "bad", loadChildren: () => import("./lazy-core.module.ts").then((m) => m.BadLazyModule) },
  { path: "collision", loadChildren: () => import("./lazy-collision.module.ts").then((m) => m.CollisionModule) },
  { path: "reports", loadChildren: () => import("./lazy-reports.module.ts").then((m) => m.ReportsModule) },
];

@NgModule({
  imports: [CoreModule, CommonModule, SharedRoutesModule, RouterModule.forRoot(routes)],
  declarations: [LpRoot, LpHome, GreetingLabel],
  providers: [{ provide: "Greeting", useValue: new Greeting("root") }],
})
class AppModule {
  constructor() {
    moduleLog.push("app");
  }
  ngOnDestroy(): void {
    destroyLog.push("AppModule");
  }
}

async function boot() {
  const host = document.createElement("lp-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(AppModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    host,
    appRef,
    injector,
    router: injector.get<Router>(Router.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

async function settle($rootScope: angular.IRootScopeService, nav: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 20; i++) {
    $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await nav;
}

afterEach(() => {
  moduleLog.length = 0;
  destroyLog.length = 0;
  routeLog.length = 0;
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
});

describe("ngjs-core/router — paridad de @NgModule lazy con Angular", () => {
  it("#3: junta las rutas forChild de un módulo importado que ya estaba cargado eager", async () => {
    const { host, appRef, router, $rootScope } = await boot();

    await settle($rootScope, router.navigateByUrl("/shared"));
    expect(host.textContent).toContain("shared page");

    await settle($rootScope, router.navigateByUrl("/reports/shared"));
    expect(host.textContent).toContain("shared page");

    await settle($rootScope, router.navigateByUrl("/reports/home"));
    expect(host.textContent).toContain("reports home");
    appRef.destroy();
  });

  it("#6: navegar por nombre al padre de un módulo lazy con ruta índice (ui-sref / $state.go)", async () => {
    const { host, appRef, injector, $rootScope } = await boot();
    const $state = injector.get<StateService>("$state");

    await settle($rootScope, $state.go("admin"));
    expect(host.textContent).toContain("hola admin");

    await settle($rootScope, $state.go("admin.users_id", { id: "9" }));
    expect(host.textContent).toContain("admin user 9");

    await settle($rootScope, $state.go("admin"));
    expect(host.textContent).toContain("hola admin");
    appRef.destroy();
  });

  it("#4: instancia las clases @NgModule con DI de constructor, imports primero", async () => {
    const { appRef } = await boot();
    expect(moduleLog).toEqual(["core:core-config", "app"]);
    appRef.destroy();
  });

  it("#4: @Optional() @SkipSelf() ve la instancia de la app desde un módulo lazy (guard de CoreModule)", async () => {
    const { host, appRef, router, injector, $rootScope } = await boot();
    const errors: unknown[] = [];
    injector
      .get<TransitionService>("$transitions")
      .onError({}, (transition) => void errors.push(transition.error().detail));
    await settle(
      $rootScope,
      router.navigateByUrl("/bad").catch(() => undefined),
    );

    expect(host.textContent).not.toContain("bad page");
    expect(String(errors[0] ?? "")).toContain("CoreModule ya está cargado");
    appRef.destroy();
  });

  it("#2: un componente lazy con un selector que ya existe en la app da un error claro", async () => {
    const { host, appRef, router, injector, $rootScope } = await boot();
    const errors: unknown[] = [];
    injector
      .get<TransitionService>("$transitions")
      .onError({}, (transition) => void errors.push(transition.error().detail));
    await settle(
      $rootScope,
      router.navigateByUrl("/collision").catch(() => undefined),
    );

    expect(host.textContent).not.toContain("otro home");
    expect(String(errors[0] ?? "")).toContain('declara un componente "lpHome" que ya existe');
    appRef.destroy();
  });

  it("#1: los providers del módulo lazy quedan aislados en su rama (override incluido)", async () => {
    const { host, appRef, router, injector, $rootScope } = await boot();
    $rootScope.$digest();
    expect(host.textContent).toContain("[root]"); // `Greeting` de la app ya instanciado

    await settle($rootScope, router.navigateByUrl("/env"));
    // Servicio lazy → servicio lazy vía `inject()` en field initializer, y el override de `Greeting`.
    expect(host.querySelector(".report")?.textContent).toBe("lazy#42");
    // Componente eager (declarado en AppModule) renderizado dentro de la rama lazy ve el provider lazy.
    expect(host.textContent).toContain("[lazy]");
    // Pipe declarado en el módulo lazy resuelve contra el entorno de la rama.
    expect(host.querySelector(".pipe")?.textContent).toBe("hey!lazy");

    // Fuera de la rama: nada del módulo lazy existe y `Greeting` sigue siendo el de la app.
    expect(injector.has("LazyCounter")).toBe(false);
    expect(injector.has("LazyReport")).toBe(false);
    expect(injector.get<Greeting>("Greeting").text).toBe("root");
    await settle($rootScope, router.navigateByUrl("/"));
    expect(host.textContent).toContain("[root]");

    // El entorno de la rama persiste entre navegaciones (mismo `LazyCounter`), como en Angular.
    await settle($rootScope, router.navigateByUrl("/env"));
    expect(host.querySelector(".report")?.textContent).toBe("lazy#43");
    appRef.destroy();
  });

  it("destroy: appRef.destroy() corre ngOnDestroy de servicios lazy y clases @NgModule (ramas antes que la raíz)", async () => {
    const { appRef, router, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/env"));
    expect(destroyLog).toEqual([]);

    appRef.destroy();
    expect(destroyLog).toEqual(["LazyCounter", "EnvModule", "AppModule"]);
  });

  it("la instancia de la clase @NgModule es inyectable: la de la app en la raíz, la de la rama en la rama", async () => {
    const { host, appRef, router, injector, $rootScope } = await boot();
    const appModule = injector.get<AppModule>(ngModuleInjectionName((AppModule as unknown as { $name: string }).$name));
    // El id del módulo NO es un nombre de DI: no pisa un provider con el mismo string.
    expect(injector.has((AppModule as unknown as { $name: string }).$name)).toBe(false);
    expect(appModule).toBeInstanceOf(AppModule);
    expect(moduleLog.filter((entry) => entry === "app")).toHaveLength(1); // misma instancia que creó el `.run`

    const { envModuleInstanceCount } = await import("./lazy-env.module.ts");
    const before = envModuleInstanceCount();
    await settle($rootScope, router.navigateByUrl("/env"));
    // Una sola instancia nueva (la de la rama) y es la que recibió el componente.
    expect(envModuleInstanceCount()).toBe(before + 1);
    expect(host.querySelector(".module")?.textContent).toBe(`env-module-${before + 1}`);
    expect(injector.has(ngModuleInjectionName("EnvModule"))).toBe(false); // la del módulo lazy no está en la app
    appRef.destroy();
  });

  it("guards, resolvers y title de rutas de la rama resuelven inject() contra el injector de la rama", async () => {
    const { host, appRef, router, $rootScope } = await boot();

    await settle($rootScope, router.navigateByUrl("/env/guarded"));
    expect(host.querySelector(".guarded")).not.toBeNull();
    expect(document.title).toBe("title-lazy");

    await settle($rootScope, router.navigateByUrl("/"));
    // Segunda entrada, con la rama ya cargada: el guard de la ruta `loadChildren` sigue en el padre.
    await settle($rootScope, router.navigateByUrl("/env/guarded"));
    expect(routeLog).toEqual(
      expect.arrayContaining([
        "lazyRoute:root",
        "canMatch:lazy",
        "canActivate:lazy",
        "resolve:lazy",
        "canDeactivate:lazy",
      ]),
    );
    expect(routeLog.filter((entry) => entry.endsWith(":root"))).toEqual(["lazyRoute:root", "lazyRoute:root"]);
    appRef.destroy();
  });

  it("inject(Injector) dentro de la rama resuelve providers lazy; fuera sigue siendo el de la app", async () => {
    const { host, appRef, router, injector, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/env"));
    expect(host.querySelector(".injector")?.textContent).toBe("lazy|true|fallback");

    const appInjector = injector.get<{ get(token: string, notFound?: unknown): unknown }>("Injector");
    expect(appInjector.get("LazyCounter", null)).toBeNull();
    appRef.destroy();
  });

  it("componentes dinámicos creados desde la rama (ViewContainerRef / createComponent con su Injector) ven los providers lazy", async () => {
    const { host, appRef, router, $rootScope } = await boot();
    await settle($rootScope, router.navigateByUrl("/env/dynamic"));

    // Por `ViewContainerRef`: el host se inserta junto al contenedor, dentro de la rama.
    expect(host.textContent).toContain("[lazy]");
    // Fuera del DOM de la rama (en `<body>`), con el `Injector` de la rama.
    expect(document.querySelector(".outside-host")?.textContent).toBe("[lazy]");
    appRef.destroy();
  });
});
