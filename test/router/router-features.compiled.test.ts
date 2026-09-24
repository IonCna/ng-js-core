import { afterEach, describe, expect, it } from "vitest";
import { RouterApp } from "./router-app.ts";

const HEADER = `import { Component, Injectable, NgModule, inject } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
import { ActivatedRoute, RouterModule, TitleStrategy, withInMemoryScrolling, withRouterConfig, type Routes } from "ngjs-core/router";
@Component({ selector: "app-root", template: "<ui-view></ui-view>" })
export class AppRoot {}
`;

type Observable<T> = { subscribe(fn: (value: T) => void): void };

/**
 * Porta de `old/test/router/router-{forchild,sref-url,in-memory-scrolling,params-inheritance}.test.ts`.
 */
describe("ngjs-core/router — forChild, ui-sref, scroll y herencia de data (código compilado)", () => {
  let app: RouterApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  const boot = (code: string, url = "/") => RouterApp.boot({ "app.module.ts": `${HEADER}${code}` }, url);

  describe("forChild se acerca a Angular (title / canDeactivate / canMatch / redirect cruzado)", () => {
    const forChild = `
@Component({ selector: "fc-home", template: "<h1>home</h1>" })
export class FcHome {}
@Component({ selector: "fc-plain", template: "<h2>plain</h2>" })
export class FeaturePlain {}
@Component({ selector: "fc-list", template: "<h2>list</h2>" })
export class FeatureList {}
@Component({ selector: "fc-detail", template: "<h2>detail</h2>" })
export class FeatureDetail {}
@Injectable()
export class FeatureState {
  canLeave = true;
  canEnter = true;
  appliedTitles: (string | undefined)[] = [];
}
@Injectable()
export class TitleStrategyWithState extends TitleStrategy {
  constructor(private readonly state: FeatureState) { super(); }
  updateTitle(title: string | undefined): void { this.state.appliedTitles.push(title); document.title = title ?? ""; }
}
const rootRoutes: Routes = [
  { path: "", component: FcHome },
  // redirect CRUZADO: apunta a un path (con canMatch) que registra el forChild.
  { path: "go-feature", redirectTo: "feature/list", pathMatch: "full" },
];
const featureRoutes: Routes = [
  { path: "feature/plain", component: FeaturePlain, title: "Feature plain" },
  { path: "feature/list", component: FeatureList, title: "Feature list", canMatch: [() => inject(FeatureState).canEnter] },
  { path: "feature/detail", component: FeatureDetail, title: (s) => "Detail " + s.data.kind, data: { kind: "x" }, canDeactivate: [() => inject(FeatureState).canLeave] },
];
@NgModule({
  imports: [CommonModule, RouterModule.forRoot(rootRoutes), RouterModule.forChild(featureRoutes)],
  declarations: [AppRoot, FcHome, FeaturePlain, FeatureList, FeatureDetail],
  providers: [FeatureState, { provide: TitleStrategy, useClass: TitleStrategyWithState }],
  bootstrap: [AppRoot],
})
export class AppModule {}
`;
    const state = () =>
      app!.app.inject<{ canLeave: boolean; canEnter: boolean; appliedTitles: (string | undefined)[] }>(
        "FeatureState",
        "test-app",
      );

    it("el title de una ruta de forChild actualiza el título", async () => {
      app = await boot(forChild);
      await app.navigate("/feature/plain");
      expect(state().appliedTitles).toContain("Feature plain");
      expect(app.app.document.title).toBe("Feature plain");
    });

    it("la data llega a la ResolveFn de title y a ActivatedRoute.data en rutas de forChild", async () => {
      app = await boot(forChild);
      await app.navigate("/feature/detail");
      expect(app.app.document.title).toBe("Detail x");
      const data = await new Promise<Record<string, unknown>>((resolve) =>
        app!.app.inject<{ data: Observable<Record<string, unknown>> }>("ActivatedRoute").data.subscribe(resolve),
      );
      expect(data.kind).toBe("x");
    });

    it("canDeactivate de una ruta de forChild bloquea la salida", async () => {
      app = await boot(forChild);
      expect(await app.navigate("/feature/detail")).toBe(true);
      expect(app.text).toContain("detail");

      state().canLeave = false;
      expect(await app.navigate("/")).toBe(false);
      expect(app.text).toContain("detail");

      state().canLeave = true;
      expect(await app.navigate("/")).toBe(true);
      expect(app.text).toContain("home");
    });

    it("canMatch de una ruta de forChild aborta la transición cuando devuelve false", async () => {
      app = await boot(forChild);
      state().canEnter = false;
      expect(await app.navigate("/feature/list")).toBe(false);
      expect(app.text).not.toContain("list");

      state().canEnter = true;
      expect(await app.navigate("/feature/list")).toBe(true);
      expect(app.text).toContain("list");
    });

    it("redirectTo cruzado: una ruta de forRoot redirige a un path (con canMatch) de forChild", async () => {
      app = await boot(forChild);
      // el redirect supersede la transición original; importa que termina montando el destino de forChild
      await app.navigate("/go-feature").catch(() => undefined);
      expect(app.text).toContain("list");
    });

    it("llamar RouterModule.forRoot() dos veces en la misma app lanza el guard", async () => {
      await expect(
        boot(`
@NgModule({ imports: [CommonModule, RouterModule.forRoot([]), RouterModule.forRoot([])], declarations: [AppRoot], bootstrap: [AppRoot] })
export class AppModule {}
`),
      ).rejects.toThrow(/forRoot\(\) se llamó dos veces/);
    });
  });

  it("ui-sref acepta forma URL: href + params, state name nativo intacto, click navega, ui-sref-active, expresión de scope", async () => {
    app = await boot(`
@Component({ selector: "sref-home", template: "<h1>home</h1>" })
export class HomePage {}
@Component({ selector: "sref-about", template: "<h1>about</h1>" })
export class AboutPage {}
@Component({ selector: "sref-users", template: "<h1>users</h1><ui-view></ui-view>" })
export class UsersPage {}
@Component({ selector: "sref-user-detail", template: "<h1>user</h1>" })
export class UserDetailPage {}
@Component({
  selector: "sref-root",
  controllerAs: "$",
  template: \`
    <a id="l-users" ui-sref="/users">users</a>
    <a id="l-user" ui-sref="/users/5">user 5</a>
    <a id="l-about" ui-sref="/about" ui-sref-active="is-active">about</a>
    <a id="l-name" ui-sref="about">about (state name)</a>
    <a id="l-dotted" ui-sref="users.id({ id: '9' })">user 9</a>
    <a ng-repeat="tab in $.tabs track by tab.to" id="{{ 'l-tab-' + $index }}" ui-sref="tab.to">{{ tab.name }}</a>
    <ui-view></ui-view>
  \`,
})
export class SrefRoot {
  tabs = [{ name: "Home", to: "/" }, { name: "About", to: "/about" }];
}
const routes: Routes = [
  { path: "", component: HomePage },
  { path: "about", component: AboutPage },
  { path: "users", component: UsersPage, children: [{ path: ":id", component: UserDetailPage }] },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, SrefRoot, HomePage, AboutPage, UsersPage, UserDetailPage], bootstrap: [SrefRoot] })
export class AppModule {}
`);
    const $state = app.app.get<{
      href(name: string, params?: Record<string, string>): string;
      current: { name: string };
      params: Record<string, string>;
    }>("$state");
    const doc = app.app.document;
    const href = (id: string) => doc.getElementById(id)?.getAttribute("href");
    const click = async (id: string) => {
      const MouseEvent = (app!.app.window as unknown as { MouseEvent: typeof globalThis.MouseEvent }).MouseEvent;
      doc.getElementById(id)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      // clickHook difiere el $state.go con $timeout(0)
      await app!.settle();
    };

    expect(href("l-users")).toBe($state.href("users"));
    expect(href("l-user")).toBe($state.href("users.id", { id: "5" }));
    expect(href("l-user")).toContain("/users/5");
    expect(href("l-name")).toBe($state.href("about"));
    expect(href("l-about")).toBe($state.href("about"));
    expect(href("l-dotted")).toBe($state.href("users.id", { id: "9" }));

    await click("l-user");
    expect($state.current.name).toBe("users.id");
    expect($state.params.id).toBe("5");
    expect(app.text).toContain("user");

    expect(doc.getElementById("l-about")?.classList.contains("is-active")).toBe(false);
    await app.navigate("/about");
    expect(doc.getElementById("l-about")?.classList.contains("is-active")).toBe(true);

    expect(href("l-tab-1")).toBe($state.href("about"));
    await click("l-tab-0");
    expect(app.text).toContain("home");
  });

  describe("withInMemoryScrolling", () => {
    const scrolling = (feature: string) => `
export const scrolls: number[][] = [];
(globalThis as any).scrolls = scrolls;
window.scrollTo = ((x: number, y: number) => { scrolls.push([x, y]); }) as typeof window.scrollTo;
@Component({ selector: "ims-home", template: "<h1>home</h1>" })
export class ImsHome {}
@Component({ selector: "ims-page", template: '<h1>page</h1><div id="sec">x</div>' })
export class ImsPage {}
const routes: Routes = [{ path: "", component: ImsHome }, { path: "page", component: ImsPage }];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes${feature ? `, ${feature}` : ""})], declarations: [AppRoot, ImsHome, ImsPage], bootstrap: [AppRoot] })
export class AppModule {}
`;
    const scrolls = () => app!.app.global<number[][]>("scrolls");

    it("scrollPositionRestoration: 'top' → scroll a [0,0] tras navegar", async () => {
      app = await boot(scrolling(`withInMemoryScrolling({ scrollPositionRestoration: "top" })`));
      scrolls().length = 0;
      await app.navigate("/page");
      expect(scrolls()).toContainEqual([0, 0]);
    });

    it("anchorScrolling: 'enabled' → scroll al elemento del #fragment (gana sobre top)", async () => {
      app = await boot(
        scrolling(`withInMemoryScrolling({ scrollPositionRestoration: "top", anchorScrolling: "enabled" })`),
      );
      scrolls().length = 0;
      const pending = app.router.navigateByUrl("/page#sec");
      // #sec se monta en la transición; stubbeamos su rect antes de que corra el $timeout(0).
      const $rootScope = app.app.get<{ $$phase: string | null; $apply(): void }>("$rootScope");
      for (let i = 0; i < 10 && !app.query("#sec"); i++) {
        if (!$rootScope.$$phase) $rootScope.$apply();
        await Promise.resolve();
      }
      const sec = app.query("#sec");
      expect(sec).not.toBeNull();
      if (sec) sec.getBoundingClientRect = () => ({ top: 120, left: 0 }) as DOMRect;
      await app.settle(pending);
      expect(scrolls()).toContainEqual([0, 120]);
    });

    it("scrollPositionRestoration: 'enabled' yendo adelante → scroll a [0,0]", async () => {
      app = await boot(scrolling(`withInMemoryScrolling({ scrollPositionRestoration: "enabled" })`));
      scrolls().length = 0;
      await app.navigate("/page");
      expect(scrolls()).toContainEqual([0, 0]);
    });

    it("scrollPositionRestoration: 'enabled' → restaura la posición guardada en un back/forward", async () => {
      app = await boot(scrolling(`withInMemoryScrolling({ scrollPositionRestoration: "enabled" })`));
      const scroller = app.app.inject<{ getScrollPosition(): [number, number] }>("ViewportScroller");
      await app.navigate("/page");
      scroller.getScrollPosition = () => [0, 300];
      await app.navigate("/"); // el onBefore guarda /page → [0,300]
      scrolls().length = 0;

      const { PopStateEvent } = app.app.window as unknown as { PopStateEvent: typeof globalThis.PopStateEvent };
      app.app.window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      await app.navigate("/page");

      expect(scrolls()).toContainEqual([0, 300]);
      expect(scrolls()).not.toContainEqual([0, 0]);
    });

    it("sin el feature → no toca el scroll", async () => {
      app = await boot(scrolling(""));
      scrolls().length = 0;
      await app.navigate("/page");
      expect(scrolls()).toEqual([]);
    });
  });

  describe("paramsInheritanceStrategy (integración vía RouterModule.forRoot)", () => {
    const inheritance = (feature: string) => `
@Component({ selector: "pi-home", template: "<h1>home</h1>" })
export class HomePi {}
@Component({ selector: "pi-leaf", template: "<h1>leaf</h1>" })
export class LeafPi {}
const routes: Routes = [
  { path: "", component: HomePi },
  // Padre con URL propia (no vacía) — como components/nav en ngbjs-doc.
  { path: "parent", data: { title: "Parent", tabs: ["a", "b"] }, children: [{ path: "leaf", component: LeafPi, data: { sections: ["s1"] } }] },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes${feature ? `, ${feature}` : ""})], declarations: [AppRoot, HomePi, LeafPi], bootstrap: [AppRoot] })
export class AppModule {}
`;
    const leafData = async () => {
      let data: Record<string, unknown> = {};
      app!.app
        .inject<{ data: Observable<Record<string, unknown>> }>("ActivatedRoute")
        .data.subscribe((d) => (data = d));
      await app!.navigate("/parent/leaf");
      return data;
    };

    it("'emptyOnly' (default): NO hereda data del padre con path propio no vacío", async () => {
      app = await boot(inheritance(""));
      const data = await leafData();
      expect(data.sections).toEqual(["s1"]);
      expect(data.title).toBeUndefined();
      expect(data.tabs).toBeUndefined();
    });

    it("'always': hereda data de toda la cadena, incluso con path propio no vacío", async () => {
      app = await boot(inheritance(`withRouterConfig({ paramsInheritanceStrategy: "always" })`));
      const data = await leafData();
      expect(data.sections).toEqual(["s1"]);
      expect(data.title).toBe("Parent");
      expect(data.tabs).toEqual(["a", "b"]);
    });
  });
});
