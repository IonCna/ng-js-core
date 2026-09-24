import { afterEach, describe, expect, it } from "vitest";
import { RouterApp } from "./router-app.ts";

const HEADER = `import { Component, Injectable, NgModule, inject } from "ngjs-core";
import { CommonModule } from "ngjs-core/common";
import { RouterModule, TitleStrategy, type Routes } from "ngjs-core/router";
@Component({ selector: "app-root", template: "<ui-view></ui-view>" })
export class AppRoot {}
`;

/**
 * Porta de `old/test/router/router-{title-strategy,guard-inject,guards-tier5,redirect-guarded,name-collision}.test.ts`.
 */
describe("ngjs-core/router — guards, títulos y nombres (código compilado)", () => {
  let app: RouterApp | undefined;

  afterEach(async () => {
    await app?.destroy();
    app = undefined;
  });

  const boot = (code: string, url = "/") => RouterApp.boot({ "app.module.ts": `${HEADER}${code}` }, url);

  it("TitleStrategy provisto por DI reemplaza cómo se aplica el título; sin title no se llama; la ResolveFn recibe la data real", async () => {
    app = await boot(`
@Component({ selector: "tts-a", template: "<h1>a</h1>" })
export class PageA {}
@Component({ selector: "tts-b", template: "<h1>b</h1>" })
export class PageB {}
@Component({ selector: "tts-d", template: "<h1>d</h1>" })
export class PageD {}
export const applied: (string | undefined)[] = [];
(globalThis as any).applied = applied;
@Injectable()
export class SuffixTitleStrategy extends TitleStrategy {
  updateTitle(title: string | undefined): void { applied.push(title); document.title = title === undefined ? "Mi App" : title + " · Mi App"; }
}
const routes: Routes = [
  { path: "a", component: PageA, title: "A" },
  { path: "b", component: PageB },
  { path: "d/:id", component: PageD, title: (s) => "D/" + s.data.section + "/" + s.params.id, data: { section: "z" } },
];
@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [AppRoot, PageA, PageB, PageD],
  providers: [{ provide: TitleStrategy, useClass: SuffixTitleStrategy }],
  bootstrap: [AppRoot],
})
export class AppModule {}
`);
    const applied = app.app.global<(string | undefined)[]>("applied");
    await app.navigate("/a");
    expect(applied).toEqual(["A"]);
    expect(app.app.document.title).toBe("A · Mi App");

    await app.navigate("/b");
    expect(applied).toEqual(["A"]);

    await app.navigate("/d/7");
    expect(applied).toEqual(["A", "D/z/7"]);
    expect(app.app.document.title).toBe("D/z/7 · Mi App");
  });

  it("un guard funcional con inject() bloquea o deja pasar según el servicio", async () => {
    app = await boot(`
@Injectable()
export class AuthService { allowed = false; }
@Component({ selector: "gi-home", template: "<h1>home</h1>" })
export class GiHome {}
@Component({ selector: "gi-secret", template: "<h1>secret</h1>" })
export class GiSecret {}
const routes: Routes = [
  { path: "", component: GiHome },
  { path: "secret", component: GiSecret, canActivate: [() => inject(AuthService).allowed] },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, GiHome, GiSecret], providers: [AuthService], bootstrap: [AppRoot] })
export class AppModule {}
`);
    expect(app.text).toContain("home");
    expect(await app.navigate("/secret")).toBe(false);
    expect(app.text).toContain("home");

    app.app.inject<{ allowed: boolean }>("AuthService", "test-app").allowed = true;
    expect(await app.navigate("/secret")).toBe(true);
    expect(app.text).toContain("secret");
  });

  const tier5 = `
@Component({ selector: "t5-home", template: "<h1>home</h1>" })
export class T5Home {}
@Component({ selector: "t5-editor", template: "<h1>editor</h1>" })
export class T5Editor { dirty = true; }
@Component({ selector: "t5-flagged", template: "<h1>flagged</h1>" })
export class T5Flagged {}
@Component({ selector: "t5-nf", template: "<h1>not found</h1>" })
export class T5NotFound {}
export const state: { allowMatch: boolean; deactivateArgs?: unknown[] } = { allowMatch: false };
(globalThis as any).state = state;
(globalThis as any).T5Editor = T5Editor;
const routes: Routes = [
  { path: "", component: T5Home },
  {
    path: "editor/:id",
    component: T5Editor,
    data: { role: "editor" },
    canDeactivate: [(component, currentRoute, currentState, nextState) => { state.deactivateArgs = [component, currentRoute, currentState, nextState]; return !(component as T5Editor)?.dirty; }],
  },
  { path: "flagged", component: T5Flagged, canMatch: [() => state.allowMatch] },
  { path: "**", component: T5NotFound },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, T5Home, T5Editor, T5Flagged, T5NotFound], bootstrap: [AppRoot] })
export class AppModule {}
`;

  it("canMatch false bloquea la navegación (se queda donde estaba); true matchea", async () => {
    app = await boot(tier5);
    await app.navigate("/flagged").catch(() => undefined);
    expect(app.text).toContain("home");

    app.app.global<{ allowMatch: boolean }>("state").allowMatch = true;
    await app.navigate("/flagged");
    expect(app.text).toContain("flagged");
  });

  it("canDeactivate false bloquea la salida y recibe la firma completa de Angular (componente, ruta, estado actual y siguiente)", async () => {
    app = await boot(tier5);
    await app.navigate("/editor/42");
    expect(app.text).toContain("editor");

    await app.navigate("/").catch(() => undefined);
    expect(app.text).toContain("editor");
    const [component, currentRoute, currentState, nextState] = app.app.global<{ deactivateArgs: unknown[] }>("state")
      .deactivateArgs as [
      { dirty: boolean },
      { params: Record<string, string>; data: Record<string, unknown> },
      { url: string; root: { params: Record<string, string> } },
      { url: string },
    ];
    expect(component).toBeInstanceOf(app.app.global<Function>("T5Editor"));
    expect(currentRoute.params.id).toBe("42");
    expect(currentRoute.data.role).toBe("editor");
    expect(currentState.url).toContain("/editor/42");
    expect(currentState.root.params.id).toBe("42");
    expect(nextState.url).toBe("/");

    component.dirty = false;
    await app.navigate("/");
    expect(app.text).toContain("home");
  });

  for (const guard of ["canActivate", "canMatch"] as const) {
    it(`redirectTo hacia una ruta con ${guard} sync se completa en la primera navegación`, async () => {
      app = await boot(`
@Injectable()
export class Flag { ok = true; }
@Component({ selector: "rg-home", template: "<h1>home</h1>" })
export class RgHome {}
@Component({ selector: "rg-target", template: "<h2>target</h2>" })
export class RgTarget {}
const routes: Routes = [
  { path: "", component: RgHome },
  { path: "go", redirectTo: "target", pathMatch: "full" },
  { path: "target", component: RgTarget, ${guard}: [() => inject(Flag).ok] },
];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, RgHome, RgTarget], providers: [Flag], bootstrap: [AppRoot] })
export class AppModule {}
`);
      await app.navigate("/go");
      expect(app.text).toContain("target");
    });
  }

  it("dos paths que sanitizan igual (a/b y a.b) registran ambos estados", async () => {
    app = await boot(`
@Component({ selector: "nc-one", template: "<h1>one</h1>" })
export class NcOne {}
@Component({ selector: "nc-two", template: "<h1>two</h1>" })
export class NcTwo {}
const routes: Routes = [{ path: "a/b", component: NcOne }, { path: "a.b", component: NcTwo }];
@NgModule({ imports: [CommonModule, RouterModule.forRoot(routes)], declarations: [AppRoot, NcOne, NcTwo], bootstrap: [AppRoot] })
export class AppModule {}
`);
    await app.navigate("/a/b");
    expect(app.text).toContain("one");
    await app.navigate("/a.b");
    expect(app.text).toContain("two");
  });
});
