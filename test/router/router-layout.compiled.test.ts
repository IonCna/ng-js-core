import { afterEach, describe, expect, it } from "vitest";
import { LAZY_FIXTURES } from "./lazy-fixtures.ts";
import { RouterApp } from "./router-app.ts";

const HEADER = `import { Component, Inject, Injectable, InjectionToken, NgModule, inject } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
import { of, type Observable } from "rxjs";
import { PreloadAllModules, PreloadingStrategy, RouterModule, withPreloading, type Route, type Routes } from "ngjs-core/router";
import { counters } from "./counters";
@Component({ selector: "app-root", template: "<ui-view></ui-view>" })
export class AppRoot {}
`;

/**
 * Porta de `old/test/router/router-{root-layout,root-layout-redirect,preloading,route-providers}.test.ts`.
 * `Route.providers`: AngularJS tiene un solo injector, así que los providers de una ruta se registran en la app al
 * arrancar (no por rama como en Angular). Se prueba lo que eso garantiza — que existen y que guards, resolvers,
 * componentes y un módulo lazy de la rama los ven — y no el aislamiento (mismo token con valores distintos por ruta).
 */
describe("ngjs-core/router — layout raíz, preloading y Route.providers (código compilado)", () => {
  let app: RouterApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  const boot = (code: string, url = "/") =>
    RouterApp.boot({ ...LAZY_FIXTURES, "app.module.ts": `${HEADER}${code}` }, url);

  describe("layout raíz con path vacío", () => {
    const layout = (children: string) => `
@Component({ selector: "rl-shell", template: "<nav class='shell'>shell <a id='about' ui-sref='/about'>about</a></nav><ui-view></ui-view>" })
export class RlShell {}
@Component({ selector: "rl-home", template: "<h1>home</h1>" })
export class RlHome {}
@Component({ selector: "rl-about", template: "<h1>about</h1>" })
export class RlAbout {}
@Component({ selector: "rl-not-found", template: "<h1>not found</h1>" })
export class RlNotFound {}
const routes: Routes = [{ path: "", component: RlShell, children: ${children} }];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, RlShell, RlHome, RlAbout, RlNotFound], bootstrap: [AppRoot] })
export class AppModule {}
`;
    const withChildren = layout(`[
  { path: "", component: RlHome },
  { path: "about", component: RlAbout },
  { path: "admin", loadChildren: () => import("./lazy-admin.module").then((m) => m.AdminModule) },
  { path: "**", component: RlNotFound },
]`);

    it("`/` renderiza el shell con el hijo índice", async () => {
      app = await boot(withChildren, "/");
      expect(app.query(".shell")).not.toBeNull();
      expect(app.text).toContain("home");
    });

    it("un hijo eager (`/about`) matchea por URL, dentro del shell", async () => {
      app = await boot(withChildren, "/about");
      expect(app.query(".shell")).not.toBeNull();
      expect(app.text).toContain("about");
      expect(app.query("#about")?.getAttribute("href")).toBe("/about");
    });

    it("navegar entre hijos y a un módulo lazy hijo del shell", async () => {
      app = await boot(withChildren, "/");
      await app.navigate("/admin/users/5");
      expect(app.query(".shell")).not.toBeNull();
      expect(app.text).toContain("admin user 5");
      await app.navigate("/");
      expect(app.text).toContain("home");
    });

    it("el `**` hijo del shell atrapa las URLs desconocidas", async () => {
      app = await boot(withChildren, "/no/existe");
      expect(app.query(".shell")).not.toBeNull();
      expect(app.text).toContain("not found");
    });

    it("`/` con redirect índice redirige al hijo, dentro del shell", async () => {
      app = await boot(
        layout(`[{ path: "", pathMatch: "full", redirectTo: "about" }, { path: "about", component: RlAbout }]`),
        "/",
      );
      expect(app.app.window.location.pathname).toBe("/about");
      expect(app.query(".shell")).not.toBeNull();
      expect(app.text).toContain("about");
    });
  });

  describe("withPreloading", () => {
    const preloading = (strategy: string, extra = "") => `
@Component({ selector: "pl-home", template: "<h1>home</h1>" })
export class PlHome {}
${extra}
const routes: Routes = [
  { path: "", component: PlHome },
  { path: "admin", data: { preload: true }, loadChildren: () => { counters.admin += 1; return import("./lazy-admin.module").then((m) => m.AdminModule); } },
  { path: "nested", loadChildren: () => { counters.nested += 1; return import("./nested.routes").then((m) => m.NESTED_ROUTES); } },
  { path: "page", loadComponent: () => { counters.page += 1; return import("./lazy-page.component"); } },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes, withPreloading(${strategy}))], declarations: [AppRoot, PlHome], bootstrap: [AppRoot] })
export class AppModule {}
`;
    const counters = () => app!.app.global<Record<string, number>>("counters");

    it("PreloadAllModules baja loadChildren (@NgModule y Routes), loadComponent y los lazy anidados", async () => {
      app = await boot(preloading("PreloadAllModules"));
      await app.settle();
      expect(app.text).toContain("home");
      expect(counters()).toMatchObject({ admin: 1, nested: 1, deep: 1, page: 1 });

      // Ya precargado: navegar no vuelve a bajar nada.
      await app.navigate("/admin");
      expect(app.text).toContain("hola admin");
      await app.navigate("/nested/deep");
      expect(app.text).toContain("deep page");
      await app.navigate("/page");
      expect(app.text).toContain("lazy loaded");
      expect(counters()).toMatchObject({ admin: 1, nested: 1, deep: 1, page: 1 });
    });

    it("un ui-sref URL a un módulo lazy precargado navega aunque haya `**` (no queda atado al comodín)", async () => {
      // El link se linkea en el bootstrap (template inline), con la rama lazy aún como future state. Al precargar,
      // `admin.**` sale antes de que entre `admin`: en ese hueco `/admin` solo matchea el `**`.
      app = await boot(`
@Component({ selector: "pl-home", template: "<h1>home</h1>" })
export class PlHome {}
@Component({ selector: "pl-root", template: "<a id='to-admin' ui-sref='/admin'>admin</a><ui-view></ui-view>" })
export class PlRoot {}
const routes: Routes = [
  { path: "", component: PlHome },
  { path: "admin", loadChildren: () => import("./lazy-admin.module").then((m) => m.AdminModule) },
  { path: "**", redirectTo: "" },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes, withPreloading(PreloadAllModules))], declarations: [AppRoot, PlRoot, PlHome], bootstrap: [PlRoot] })
export class AppModule {}
`);
      await app.settle();
      const MouseEvent = (app.app.window as unknown as { MouseEvent: typeof globalThis.MouseEvent }).MouseEvent;
      app.query("#to-admin")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      await app.settle();
      expect(app.text).toContain("hola admin");
    });

    it("navegar a un chunk mientras se precarga no lo registra dos veces", async () => {
      // El preload arranca en un microtask después de la primera navegación: el boot (que asienta) ya lo disparó; se
      // navega a /admin con el chunk recién pedido.
      app = await boot(preloading("PreloadAllModules"));
      const errors: unknown[] = [];
      await app.settle(app.router.navigateByUrl("/admin/users/5").catch((error: unknown) => errors.push(error)));
      expect(errors).toEqual([]);
      expect(app.text).toContain("admin user 5");
      expect(counters().admin).toBe(1);
    });

    it("estrategia custom (con DI de constructor) decide qué rutas precargar", async () => {
      app = await boot(
        preloading(
          "OnlyFlagged",
          `@Injectable()
export class OnlyFlagged extends PreloadingStrategy {
  constructor(@Inject("$q") readonly $q: unknown) { super(); }
  preload(route: Route, fn: () => Observable<unknown>): Observable<unknown> {
    if (!this.$q) throw new Error("sin DI");
    if (route.data?.preload) return fn();
    counters.skipped += 1;
    return of(null);
  }
}`,
        ),
      );
      await app.settle();
      expect(counters()).toMatchObject({ admin: 1, nested: 0, page: 0, skipped: 2 });
    });
  });

  describe("Route.providers (injector único)", () => {
    const routeProviders = `
export const TENANT = new InjectionToken<string>("TENANT");
export const REGION = new InjectionToken<string>("REGION");
export const log: string[] = [];
(globalThis as any).log = log;
@Component({ selector: "rp-home", template: "<p class='home'>home</p>" })
export class RpHome {}
@Component({ selector: "rp-region", template: "<p class='region'>{{ $ctrl.region }}</p>" })
export class RpRegion { constructor(@Inject(REGION) readonly region: string) {} }
@Component({ selector: "rp-layout", template: "<h2 class='layout'>{{ $ctrl.tenant }}</h2><ui-view></ui-view>" })
export class RpLayout { tenant = inject(TENANT); }
@Component({ selector: "rp-team", template: "<p class='team'>{{ $ctrl.tenant }}</p>" })
export class RpTeam { constructor(@Inject(TENANT) readonly tenant: string) {} }
const routes: Routes = [
  { path: "", component: RpHome },
  { path: "eu", component: RpRegion, providers: [{ provide: REGION, useValue: "eu" }] },
  {
    path: "org",
    component: RpLayout,
    providers: [{ provide: TENANT, useValue: "org" }],
    canActivate: [() => { log.push("guard:" + inject(TENANT)); return true; }],
    resolve: { tenant: () => log.push("resolve:" + inject(TENANT)) },
    children: [
      { path: "team", component: RpTeam },
      { path: "lazy", loadChildren: () => import("./lazy-route-providers.module").then((m) => m.RpLazyModule) },
    ],
  },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, RpHome, RpRegion, RpLayout, RpTeam], bootstrap: [AppRoot] })
export class AppModule {}
`;
    const files = {
      "lazy-route-providers.module.ts": `
import { Component, InjectionToken, NgModule, inject } from "ngjs-core";
import { RouterModule } from "ngjs-core/router";
import { TENANT } from "./app.module";
export const LAZY_ONLY = new InjectionToken<string>("LAZY_ONLY");
@Component({ selector: "rp-lazy-page", template: "<p class='lazy-rp'>{{ $ctrl.text }}</p>" })
export class RpLazyPage { text = inject(TENANT) + "/" + inject(LAZY_ONLY); }
@NgModule({
  imports: [RouterModule.forChild([{ path: "", component: RpLazyPage }])],
  declarations: [RpLazyPage],
  providers: [{ provide: LAZY_ONLY, useValue: "lazy-only" }],
})
export class RpLazyModule {}
`,
    };
    const bootProviders = () =>
      RouterApp.boot({ ...LAZY_FIXTURES, ...files, "app.module.ts": `${HEADER}${routeProviders}` });

    it("el componente de la ruta recibe el provider de su ruta", async () => {
      app = await bootProviders();
      await app.navigate("/eu");
      expect(app.query(".region")?.textContent).toBe("eu");
    });

    it("los hijos ven los providers de la ruta; guards y resolvers los ven con inject()", async () => {
      app = await bootProviders();
      await app.navigate("/org");
      expect(app.app.global<string[]>("log")).toEqual(expect.arrayContaining(["guard:org", "resolve:org"]));

      await app.navigate("/org/team");
      expect(app.query(".layout")?.textContent).toBe("org");
      expect(app.query(".team")?.textContent).toBe("org");
    });

    it("un módulo lazy bajo una ruta con providers ve los de la ruta y los propios", async () => {
      app = await bootProviders();
      await app.navigate("/org/lazy");
      expect(app.query(".lazy-rp")?.textContent).toBe("org/lazy-only");
    });
  });
});
