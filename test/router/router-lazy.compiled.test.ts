import { afterEach, describe, expect, it } from "vitest";
import { CompiledApp } from "../compiled-app.ts";
import { LAZY_FIXTURES } from "./lazy-fixtures.ts";
import { RouterApp } from "./router-app.ts";

const HEADER = `import { Component, Inject, Injectable, NgModule, inject } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
import { NavigationError, RouterModule, type Routes } from "ngjs-core/router";
import { counters } from "./counters";
@Component({ selector: "app-root", template: "<ui-view></ui-view>" })
export class AppRoot {}
`;

type StateService = {
  go(name: string, params?: Record<string, string>): Promise<unknown>;
  get(): { name: string }[];
};
type TransitionService = { onError(criteria: object, fn: (t: { error(): { detail?: unknown } }) => void): void };

/**
 * Porta de `old/test/router/router-lazy{,-children,-controlleras,-index,-module,-module-parity,-targets}.test.ts` y
 * `router-root-lazy.test.ts`. El `router-lazy-esm-spike` (UI-Router `lazyLoad` a mano) queda cubierto por
 * `loadChildren` → `Routes`. De la paridad de `@NgModule` lazy se dejan afuera los casos de **aislamiento por rama**
 * (providers del módulo lazy solo visibles en su rama, `inject(Injector)` de la rama, `@SkipSelf` contra la app,
 * `ngOnDestroy` por rama): AngularJS tiene un solo injector y el modelo compilado los registra en la app.
 */
describe("ngjs-core/router — rutas lazy (código compilado)", () => {
  let app: RouterApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  const boot = (code: string, url = "/") =>
    RouterApp.boot({ ...LAZY_FIXTURES, "app.module.ts": `${HEADER}${code}` }, url);
  const counters = () => app!.app.global<Record<string, number>>("counters");

  /** Digiere en loop hasta que aparezca `text` (el chunk resuelve async: import() + registro + retry de UI-Router). */
  const until = async (text: string) => {
    for (let i = 0; i < 20 && !app!.text.includes(text); i++) await app!.settle();
  };

  describe("loadComponent", () => {
    it("carga el chunk con import() y monta el componente", async () => {
      app = await boot(`
@Component({ selector: "shell-page", template: "<h1>shell</h1>" })
export class ShellPage {}
const routes: Routes = [{ path: "", component: ShellPage }, { path: "lazy", loadComponent: () => import("./lazy-page.component") }];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, ShellPage], bootstrap: [AppRoot] })
export class AppModule {}
`);
      expect(app.text).toContain("shell");
      await app.navigate("/lazy");
      expect(app.text).toContain("lazy loaded");
    });

    it('renderiza en `/` el componente lazy de `path: ""`', async () => {
      app = await boot(`
const routes: Routes = [{ path: "", pathMatch: "full", loadComponent: () => import("./lazy-page.component") }];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot], bootstrap: [AppRoot] })
export class AppModule {}
`);
      await until("lazy loaded");
      expect(app.text).toContain("lazy loaded");
    });

    it("el componente lazy sin controllerAs propio usa el del @NgModule que importa el router", async () => {
      app = await boot(`
const routes: Routes = [{ path: "", pathMatch: "full", loadComponent: () => import("./lazy-controlleras.component") }];
@NgModule({ controllerAs: "$", imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot], bootstrap: [AppRoot] })
export class AppModule {}
`);
      await until("cas-ok");
      expect(app.text).toContain("cas-ok");
    });
  });

  describe("loadChildren → Routes", () => {
    const children = `
@Component({ selector: "lc-home", template: "<h1>home</h1>" })
export class LcHome {}
const routes: Routes = [
  { path: "", component: LcHome },
  { path: "admin", canActivate: [() => { counters.guard += 1; return true; }], loadChildren: () => import("./lazy-children.routes").then((m) => m.CHILD_ROUTES) },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, LcHome], bootstrap: [AppRoot] })
export class AppModule {}
`;

    it("navega a /admin/users: baja el chunk y monta el componente lazy", async () => {
      app = await boot(children);
      expect(app.text).toContain("home");
      await app.navigate("/admin/users");
      expect(app.text).toContain("lazy users page");
    });

    it("una ruta lazy con param (:id) resuelve", async () => {
      app = await boot(children);
      await app.navigate("/admin/users/42");
      expect(app.text).toContain("detail 42");
    });

    it("el canActivate de la ruta loadChildren guarda toda la rama", async () => {
      app = await boot(children);
      await app.navigate("/admin/users");
      expect(counters().guard).toBeGreaterThan(0);
    });
  });

  describe("loadChildren → @NgModule", () => {
    const lazyModule = `
@Component({ selector: "lm-home", template: "<h1>home</h1>" })
export class LmHome {}
const routes: Routes = [
  { path: "", component: LmHome },
  { path: "admin", loadChildren: () => { counters.admin += 1; return import("./lazy-admin.module").then((m) => m.AdminModule); } },
  { path: "admin-default", loadChildren: () => import("./lazy-admin.module").then((m) => ({ default: m.AdminModule })) },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, LmHome], bootstrap: [AppRoot] })
export class AppModule {}
`;

    it("baja el módulo: registra declarations + providers y monta la ruta índice", async () => {
      app = await boot(lazyModule);
      expect(app.text).toContain("home");
      await app.navigate("/admin");
      expect(app.text).toContain("hola admin");
      expect(app.text).toContain("badge");
      expect(app.app.document.title).toBe("Admin");
    });

    it("resuelve rutas hijas con param del forChild, y no recarga el módulo", async () => {
      app = await boot(lazyModule);
      await app.navigate("/admin/users/7");
      expect(app.text).toContain("admin user 7");
      await app.navigate("/admin");
      expect(app.text).toContain("hola admin");
      expect(counters().admin).toBe(1);
    });

    it("acepta { default: NgModule } (y `admin` no captura `/admin-default` por prefijo)", async () => {
      app = await boot(lazyModule);
      await app.navigate("/admin-default/users/3");
      expect(app.text).toContain("admin user 3");
      expect(counters().admin).toBe(0);
    });

    it("el forChild del chunk lazy no registra estados en la raíz", async () => {
      app = await boot(lazyModule);
      await app.navigate("/admin");
      const names = app.app
        .get<StateService>("$state")
        .get()
        .map((state) => state.name);
      expect(names).not.toContain("users_id");
      expect(names).toContain("admin.users_id");
    });
  });

  describe("módulo lazy en la raíz", () => {
    const rootLazy = `
@Component({ selector: "rl-about", template: "<h1>about</h1>" })
export class RlAbout {}
const routes: Routes = [
  { path: "about", component: RlAbout },
  { path: "", loadChildren: () => import("./lazy-admin.module").then((m) => m.AdminModule) },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, RlAbout], bootstrap: [AppRoot] })
export class AppModule {}
`;

    it("`/` carga el módulo y muestra su índice", async () => {
      app = await boot(rootLazy, "/");
      await until("hola admin");
      expect(app.text).toContain("hola admin");
    });

    it("una ruta del módulo lazy (`/users/3`) resuelve sin prefijo", async () => {
      app = await boot(rootLazy, "/users/3");
      await until("admin user 3");
      expect(app.text).toContain("admin user 3");
    });

    it("el hermano eager (`/about`) no queda tapado por el módulo lazy de la raíz", async () => {
      app = await boot(rootLazy, "/about");
      expect(app.text).toContain("about");
    });
  });

  describe("paridad de @NgModule lazy con Angular (lo que permite un injector único)", () => {
    const parity = `
import { AppCoreModule } from "./lazy-core.module";
import { SharedRoutesModule } from "./lazy-shared.module";
@Component({ selector: "lp-home", template: "<h1>home</h1>" })
export class LpHome {}
const routes: Routes = [
  { path: "", component: LpHome },
  { path: "admin", loadChildren: () => import("./lazy-admin.module").then((m) => m.AdminModule) },
  { path: "mod", loadChildren: () => import("./lazy-core.module").then((m) => m.LazyModModule) },
  { path: "collision", loadChildren: () => import("./lazy-collision.module").then((m) => m.CollisionModule) },
  { path: "reports", loadChildren: () => import("./lazy-reports.module").then((m) => m.ReportsModule) },
];
@NgModule({ imports: [AppCoreModule, CommonModule, SharedRoutesModule, RouterModule.forRoot(routes)], declarations: [AppRoot, LpHome], bootstrap: [AppRoot] })
export class AppModule {
  constructor() { (globalThis as any).moduleLog.push("app"); }
}
`;
    const transitionErrors = () => {
      const errors: unknown[] = [];
      app!.app
        .get<TransitionService>("$transitions")
        .onError({}, (transition) => void errors.push(transition.error().detail));
      return errors;
    };

    it("#3: junta las rutas forChild de un módulo importado que ya estaba cargado eager", async () => {
      app = await boot(parity);
      await app.navigate("/shared");
      expect(app.text).toContain("shared page");
      await app.navigate("/reports/shared");
      expect(app.text).toContain("shared page");
      await app.navigate("/reports/home");
      expect(app.text).toContain("reports home");
    });

    it("#6: navegar por nombre al padre de un módulo lazy con ruta índice ($state.go)", async () => {
      app = await boot(parity);
      const $state = app.app.get<StateService>("$state");
      await app.settle($state.go("admin"));
      expect(app.text).toContain("hola admin");
      await app.settle($state.go("admin.users_id", { id: "9" }));
      expect(app.text).toContain("admin user 9");
      await app.settle($state.go("admin"));
      expect(app.text).toContain("hola admin");
    });

    it("#4: instancia las clases @NgModule con DI de constructor, imports primero; la lazy al cargarse", async () => {
      app = await boot(parity);
      const moduleLog = app.app.global<string[]>("moduleLog");
      expect(moduleLog).toEqual(["core:core-config", "app"]);

      await app.navigate("/mod");
      expect(app.text).toContain("lazy module page core-config");
      expect(moduleLog).toEqual(["core:core-config", "app", "lazy"]);
    });

    it("#2: un componente lazy con un selector que ya existe en la app da un error claro", async () => {
      app = await boot(parity);
      const errors = transitionErrors();
      await app.navigate("/collision").catch(() => undefined);
      expect(app.text).not.toContain("otro home");
      expect(String(errors[0] ?? "")).toContain('declara un componente "lpHome" que ya existe');
    });

    it("los providers del módulo lazy se registran en la app al cargarse (injector único)", async () => {
      app = await boot(parity);
      const greeter = CompiledApp.tokenName("AdminGreeter", "test-app");
      expect(app.app.get<{ has(name: string): boolean }>("$injector").has(greeter)).toBe(false);
      await app.navigate("/admin");
      expect(app.app.get<{ has(name: string): boolean }>("$injector").has(greeter)).toBe(true);
    });
  });

  describe("rutas de un módulo lazy sin cargar", () => {
    const targets = `
@Component({
  selector: "lt-home",
  template: "<h1>home</h1><a id='url' ui-sref='/admin/users/7' ui-sref-active='active'>url</a><a id='name' ui-sref='admin.users_id({id: 8})'>name</a>",
})
export class LtHome {}
const routes: Routes = [
  { path: "", component: LtHome },
  { path: "go-admin", redirectTo: "/admin/users/9" },
  { path: "go-admin-root", redirectTo: "/admin" },
  { path: "admin", loadChildren: () => import("./lazy-admin.module").then((m) => m.AdminModule) },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, LtHome], bootstrap: [AppRoot] })
export class AppModule {}
(globalThis as any).NavigationError = NavigationError;
`;

    /** Arranca y junta `NavigationError`s y rechazos por el param de límite de segmento (ruido que no debe existir). */
    const bootTargets = async (code = targets) => {
      app = await boot(code);
      const NavigationErrorType = app.app.global<Function>("NavigationError");
      const navigationErrors: unknown[] = [];
      app.router.events.subscribe((event) => {
        if (event instanceof NavigationErrorType) navigationErrors.push((event as { error?: unknown }).error);
      });
      const segmentRejections: string[] = [];
      app.app.get<TransitionService>("$transitions").onError({}, (transition) => {
        const detail = String(transition.error()?.detail ?? "");
        if (detail.includes("ngjsSegmentEnd")) segmentRejections.push(detail);
      });
      return { navigationErrors, segmentRejections };
    };
    const link = (id: string) => app!.query(`#${id}`) as HTMLAnchorElement;

    it("ui-sref en forma URL: href correcto, el click navega", async () => {
      const { navigationErrors } = await bootTargets();
      expect(link("url").getAttribute("href")).toBe("/admin/users/7");

      link("url").click();
      await app!.settle();
      expect(app!.text).toContain("admin user 7");
      expect(app!.app.window.location.pathname).toBe("/admin/users/7");
      expect(navigationErrors).toEqual([]);
    });

    it("ui-sref por nombre: la intención sobre el link baja el chunk y deja el href listo", async () => {
      const { navigationErrors, segmentRejections } = await bootTargets();
      expect(link("name").getAttribute("href")).not.toBe("/admin/users/8");

      const { MouseEvent } = app!.app.window as unknown as { MouseEvent: typeof globalThis.MouseEvent };
      link("name").dispatchEvent(new MouseEvent("mouseenter"));
      await app!.settle();
      expect(link("name").getAttribute("href")).toBe("/admin/users/8");

      link("name").click();
      await app!.settle();
      expect(app!.text).toContain("admin user 8");
      expect(navigationErrors).toEqual([]);
      expect(segmentRejections).toEqual([]);
    });

    it("redirectTo hacia un hijo de un módulo lazy sin cargar", async () => {
      const { navigationErrors } = await bootTargets();
      await app!.navigate("/go-admin").catch(() => undefined);
      expect(app!.text).toContain("admin user 9");
      expect(app!.app.window.location.pathname).toBe("/admin/users/9");
      expect(navigationErrors).toEqual([]);
    });

    it("redirectTo hacia la raíz de un módulo lazy: sin rechazos intermedios", async () => {
      const { navigationErrors, segmentRejections } = await bootTargets();
      await app!.navigate("/go-admin-root").catch(() => undefined);
      expect(app!.text).toContain("hola admin");
      expect(navigationErrors).toEqual([]);
      expect(segmentRejections).toEqual([]);
    });

    it("$state.go / Router.navigate a un hijo lazy: sin rechazos intermedios", async () => {
      const { navigationErrors, segmentRejections } = await bootTargets();
      await app!.settle(app!.app.get<StateService>("$state").go("admin.users_id", { id: "11" }));
      expect(app!.text).toContain("admin user 11");

      await app!.settle(app!.router.navigate(["/admin", "users", "10"]));
      expect(app!.text).toContain("admin user 10");
      expect(navigationErrors).toEqual([]);
      expect(segmentRejections).toEqual([]);
    });

    it("ui-sref-active marca el link en forma URL cuando se está en su ruta lazy (desde un layout)", async () => {
      await bootTargets(`
@Component({ selector: "lt-home", template: "<h1>home</h1>" })
export class LtHome {}
@Component({ selector: "lt-nav", template: "<a id='nav' ui-sref='/shell/admin/users/7' ui-sref-active='active'>nav</a><ui-view></ui-view>" })
export class LtNav {}
const routes: Routes = [
  { path: "", component: LtHome },
  { path: "shell", component: LtNav, children: [{ path: "admin", loadChildren: () => import("./lazy-admin.module").then((m) => m.AdminModule) }] },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, LtHome, LtNav], bootstrap: [AppRoot] })
export class AppModule {}
(globalThis as any).NavigationError = NavigationError;
`);
      await app!.navigate("/shell");
      expect(link("nav").getAttribute("href")).toBe("/shell/admin/users/7");

      link("nav").click();
      await app!.settle();
      expect(app!.text).toContain("admin user 7");
      expect(link("nav").classList.contains("active")).toBe(true);
    });
  });
});
