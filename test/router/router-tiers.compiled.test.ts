import { afterEach, describe, expect, it } from "vitest";
import { RouterApp } from "./router-app.ts";

const HEADER = `import { Component, Injectable, NgModule, inject } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
import { ActivatedRoute, NavigationEnd, NavigationStart, RouterModule, type Routes } from "ngjs-core/router";
@Component({ selector: "app-root", template: "<ui-view></ui-view>" })
export class AppRoot {}
`;

/** Porta de `old/test/router/router-tier{2,3-activated,4}.test.ts`. */
describe("ngjs-core/router — tiers 2-4 (código compilado)", () => {
  let app: RouterApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  it("Tier 2: redirectTo, Route.title (string + fn), y path '**'", async () => {
    app = await RouterApp.boot({
      "app.module.ts": `${HEADER}
@Component({ selector: "t2-dash", template: "<h1>dashboard</h1>" })
export class DashPage {}
@Component({ selector: "t2-profile", template: "<h1>profile {{ $ctrl.id }}</h1>" })
export class ProfilePage {
  id = "";
  constructor(route: ActivatedRoute) { route.paramMap.subscribe((m) => (this.id = m.get("id") ?? "")); }
}
@Component({ selector: "t2-404", template: "<h1>not found</h1>" })
export class NotFoundPage {}
const routes: Routes = [
  { path: "", redirectTo: "dashboard", pathMatch: "full" },
  { path: "dashboard", component: DashPage, title: "Dashboard" },
  { path: "profile/:id", component: ProfilePage, title: (s) => "Profile " + s.params.id },
  { path: "**", component: NotFoundPage },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, DashPage, ProfilePage, NotFoundPage], bootstrap: [AppRoot] })
export class AppModule {}
`,
    });
    const titles: string[] = [];
    app.app
      .inject<{ title: { subscribe(fn: (t: string) => void): void } }>("ActivatedRoute")
      .title.subscribe((t) => titles.push(t));

    expect(app.text).toContain("dashboard");
    expect(app.app.document.title).toBe("Dashboard");

    await app.navigate("/profile/9");
    expect(app.text).toContain("profile 9");
    expect(app.app.document.title).toBe("Profile 9");
    expect(titles.at(-1)).toBe("Profile 9");

    await app.navigate("/nope/nope");
    expect(app.text).toContain("not found");
  });

  it("Tier 3: ActivatedRoute (queryParamMap, fragment, data resuelta) y Router.events", async () => {
    app = await RouterApp.boot({
      "app.module.ts": `${HEADER}
@Component({ selector: "t3a-home", template: "<h1>home</h1>" })
export class HomeT3 {}
@Component({ selector: "t3a-item", template: "<h1>item</h1>" })
export class ItemT3 {}
const routes: Routes = [
  { path: "", component: HomeT3 },
  { path: "item/:id", component: ItemT3, resolve: { detail: (s) => "D:" + s.params.id } },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, HomeT3, ItemT3], bootstrap: [AppRoot] })
export class AppModule {}
(globalThis as any).events = { NavigationStart, NavigationEnd };
`,
    });
    const { NavigationStart, NavigationEnd } = app.app.global<{ NavigationStart: Function; NavigationEnd: Function }>(
      "events",
    );
    const events: string[] = [];
    app.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) events.push(`start:${event.url}`);
      if (event instanceof NavigationEnd) events.push("end");
    });
    type Observable<T> = { subscribe(fn: (value: T) => void): void };
    const route = app.app.inject<{
      paramMap: Observable<{ get(k: string): string | null }>;
      queryParamMap: Observable<{ get(k: string): string | null }>;
      fragment: Observable<string | null>;
      data: Observable<Record<string, unknown>>;
      snapshot: { queryParams?: Record<string, string> };
    }>("ActivatedRoute");
    const seen: Record<string, unknown> = {};
    route.paramMap.subscribe((m) => (seen.id = m.get("id")));
    route.queryParamMap.subscribe((m) => (seen.tab = m.get("tab")));
    route.fragment.subscribe((f) => (seen.frag = f));
    route.data.subscribe((d) => (seen.detail = d.detail));

    await app.navigate("/item/5?tab=info#sec");

    expect(seen).toEqual({ id: "5", tab: "info", frag: "sec", detail: "D:5" });
    expect(route.snapshot.queryParams?.tab).toBe("info");
    expect(events.some((event) => event.startsWith("start:"))).toBe(true);
    expect(events).toContain("end");
  });

  it("Tier 4: canActivateChild protege los hijos pero no el padre, e inyecta servicios con inject()", async () => {
    app = await RouterApp.boot({
      "app.module.ts": `${HEADER}
@Injectable()
export class Gate { open = false; }
@Component({ selector: "cac-home", template: "<h1>home</h1>" })
export class CacHome {}
@Component({ selector: "cac-admin", template: "<h2>admin</h2><ui-view></ui-view>" })
export class CacAdmin {}
@Component({ selector: "cac-users", template: "<h3>users</h3>" })
export class CacUsers {}
const routes: Routes = [
  { path: "", component: CacHome },
  { path: "admin", component: CacAdmin, canActivateChild: [() => inject(Gate).open], children: [{ path: "users", component: CacUsers }] },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, CacHome, CacAdmin, CacUsers], providers: [Gate], bootstrap: [AppRoot] })
export class AppModule {}
`,
    });
    expect(await app.navigate("/admin")).toBe(true);
    expect(app.text).toContain("admin");
    expect(app.text).not.toContain("users");

    expect(await app.navigate("/admin/users")).toBe(false);
    expect(app.text).not.toContain("users");

    app.app.inject<{ open: boolean }>("Gate", "test-app").open = true;
    expect(await app.navigate("/admin/users")).toBe(true);
    expect(app.text).toContain("users");
  });
});
