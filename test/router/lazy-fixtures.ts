/**
 * Chunks lazy de los tests del router, como archivos del fixture compilado: `import("./lazy-admin.module")` los
 * baja de verdad (esbuild los deja como `import()` diferido). Porta de `old/test/router/lazy-*.ts` y `preload/*`,
 * con DI de constructor en vez de `static $inject`.
 */
export const LAZY_FIXTURES: Record<string, string> = {
  "counters.ts": `
/** Contadores compartidos entre los tests y sus chunks lazy. */
export const counters = { admin: 0, nested: 0, deep: 0, page: 0, skipped: 0, guard: 0 };
(globalThis as any).counters = counters;
`,

  "lazy-page.component.ts": `
import { Component } from "ngjs-core";
@Component({ selector: "lazy-page", template: "<h1>lazy loaded</h1>" })
export class LazyPage {}
export default LazyPage;
`,

  "lazy-controlleras.component.ts": `
import { Component } from "ngjs-core";
// SIN controllerAs: el template usa "$.", así que depende de heredarlo del @NgModule que importa el RouterModule.
@Component({ selector: "lazy-cas", template: "<span>{{ $.msg }}</span>" })
export class LazyCas { msg = "cas-ok"; }
export default LazyCas;
`,

  "lazy-admin.module.ts": `
import { Component, Injectable, NgModule } from "ngjs-core";
import { ActivatedRoute, RouterModule, type Routes } from "ngjs-core/router";

@Injectable()
export class AdminGreeter { greet(): string { return "hola admin"; } }

@Component({ selector: "admin-badge", template: "<span>badge</span>" })
export class AdminBadge {}

@Component({ selector: "admin-dashboard", template: "<h2>{{ $ctrl.message }}</h2><admin-badge></admin-badge>" })
export class AdminDashboard {
  message: string;
  constructor(greeter: AdminGreeter) { this.message = greeter.greet(); }
}

@Component({ selector: "admin-user", template: "<h2>admin user {{ $ctrl.id }}</h2>" })
export class AdminUser {
  id = "";
  constructor(route: ActivatedRoute) { route.paramMap.subscribe((map) => (this.id = map.get("id") ?? "")); }
}

const ADMIN_ROUTES: Routes = [
  { path: "", component: AdminDashboard, title: "Admin" },
  { path: "users/:id", component: AdminUser },
];

@NgModule({
  imports: [RouterModule.forChild(ADMIN_ROUTES)],
  declarations: [AdminDashboard, AdminBadge, AdminUser],
  providers: [AdminGreeter],
})
export class AdminModule {}
`,

  "lazy-children.routes.ts": `
import { Component } from "ngjs-core";
import { ActivatedRoute, type Routes } from "ngjs-core/router";

@Component({ selector: "lazy-users", template: "<h2>lazy users page</h2>" })
export class LazyUsersPage {}

@Component({ selector: "lazy-user-detail", template: "<h2>detail {{ $ctrl.userId }}</h2>" })
export class LazyUserDetailPage {
  userId = "";
  constructor(route: ActivatedRoute) { route.paramMap.subscribe((map) => (this.userId = map.get("id") ?? "")); }
}

export const CHILD_ROUTES: Routes = [
  { path: "users", component: LazyUsersPage },
  { path: "users/:id", component: LazyUserDetailPage },
];
`,

  "lazy-collision.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { RouterModule } from "ngjs-core/router";
/** Módulo lazy que declara un selector que la app ya registró (lp-home). */
@Component({ selector: "lp-home", template: "<h1>otro home</h1>" })
export class CollidingHome {}
@NgModule({ imports: [RouterModule.forChild([{ path: "", component: CollidingHome }])], declarations: [CollidingHome] })
export class CollisionModule {}
`,

  "lazy-shared.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { RouterModule } from "ngjs-core/router";
/** Módulo con forChild importado eager por la app Y por un @NgModule lazy. */
@Component({ selector: "shared-page", template: "<h2>shared page</h2>" })
export class SharedPage {}
@NgModule({ imports: [RouterModule.forChild([{ path: "shared", component: SharedPage }])], declarations: [SharedPage] })
export class SharedRoutesModule {}
`,

  "lazy-reports.module.ts": `
import { Component, NgModule } from "ngjs-core";
import { RouterModule } from "ngjs-core/router";
import { SharedRoutesModule } from "./lazy-shared.module";
/** Chunk lazy que importa un módulo con forChild ya cargado eager por la app. */
@Component({ selector: "reports-home", template: "<h2>reports home</h2>" })
export class ReportsHome {}
@NgModule({ imports: [SharedRoutesModule, RouterModule.forChild([{ path: "home", component: ReportsHome }])], declarations: [ReportsHome] })
export class ReportsModule {}
`,

  "lazy-core.module.ts": `
import { Component, Inject, NgModule } from "ngjs-core";
import { RouterModule } from "ngjs-core/router";
export const moduleLog: string[] = [];
(globalThis as any).moduleLog = moduleLog;
export class CoreConfig { readonly name = "core-config"; }
@NgModule({ providers: [{ provide: "CoreConfig", useClass: CoreConfig }] })
export class AppCoreModule {
  constructor(@Inject("CoreConfig") config: CoreConfig) { moduleLog.push("core:" + config.name); }
}
@Component({ selector: "lazy-mod-page", template: "<h2>lazy module page {{ $ctrl.config }}</h2>" })
export class LazyModPage {
  config: string;
  constructor(@Inject("CoreConfig") config: CoreConfig) { this.config = config.name; }
}
@NgModule({ imports: [RouterModule.forChild([{ path: "", component: LazyModPage }])], declarations: [LazyModPage] })
export class LazyModModule {
  constructor() { moduleLog.push("lazy"); }
}
`,

  "nested.routes.ts": `
import { Component } from "ngjs-core";
import type { Routes } from "ngjs-core/router";
import { counters } from "./counters";
/** Chunk lazy con otra ruta lazy adentro — el preloader tiene que bajar las dos. */
@Component({ selector: "nested-page", template: "<h2>nested page</h2>" })
export class NestedPage {}
export const NESTED_ROUTES: Routes = [
  { path: "", component: NestedPage },
  { path: "deep", loadChildren: () => { counters.deep += 1; return import("./deep.routes").then((m) => m.DEEP_ROUTES); } },
];
`,

  "deep.routes.ts": `
import { Component } from "ngjs-core";
import type { Routes } from "ngjs-core/router";
@Component({ selector: "deep-page", template: "<h2>deep page</h2>" })
export class DeepPage {}
export const DEEP_ROUTES: Routes = [{ path: "", component: DeepPage }];
`,
};
