import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule } from "@/router/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "sref-home", template: "<h1>home</h1>" })
class HomePage {}

@Component({ selector: "sref-about", template: "<h1>about</h1>" })
class AboutPage {}

@Component({ selector: "sref-users", controllerAs: "$", template: "<h1>users</h1><ui-view></ui-view>" })
class UsersPage {}

@Component({ selector: "sref-user-detail", template: "<h1>user</h1>" })
class UserDetailPage {}

@Component({
  selector: "sref-root",
  controllerAs: "$",
  template: `
    <a id="l-users" ui-sref="/users">users</a>
    <a id="l-user" ui-sref="/users/5">user 5</a>
    <a id="l-about" ui-sref="/about" ui-sref-active="is-active">about</a>
    <a id="l-name" ui-sref="about">about (state name)</a>
    <a id="l-dotted" ui-sref="users.id({ id: '9' })">user 9 (state name + params)</a>
    <a ng-repeat="tab in $.tabs track by tab.to" id="{{ 'l-tab-' + $index }}" ui-sref="tab.to">{{ tab.name }}</a>
    <ui-view></ui-view>
  `,
})
class SrefRoot {
  tabs = [
    { name: "Home", to: "/" },
    { name: "About", to: "/about" },
  ];
}

const routes: Routes = [
  { path: "", component: HomePage },
  { path: "about", component: AboutPage },
  {
    path: "users",
    component: UsersPage,
    children: [{ path: ":id", component: UserDetailPage }],
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forRoot(routes)],
  declarations: [SrefRoot, HomePage, AboutPage, UsersPage, UserDetailPage],
})
class AppModule {}

describe("ngjs-core/router — ui-sref acepta forma URL", () => {
  it("`/path` → state ref: href + params, state name nativo intacto, click navega, ui-sref-active", async () => {
    const host = document.createElement("sref-root");
    document.body.appendChild(host);

    const appRef = await bootstrapApplication(AppModule, { hostElement: host });
    const injector = appRef.injector as angular.auto.IInjectorService;
    const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const $state = injector.get<{
      href(name: string, params?: Record<string, string>): string;
      current: { name: string };
      params: Record<string, string>;
    }>("$state");
    const router = injector.get<Router>(Router.$name);

    $rootScope.$digest();
    $rootScope.$digest();

    const href = (id: string) => document.getElementById(id)?.getAttribute("href");

    // `/users` (sin params) y `/users/5` (param posicional) → mismo href que la forma nativa.
    expect(href("l-users")).toBe($state.href("users"));
    expect(href("l-user")).toBe($state.href("users.id", { id: "5" }));
    expect(href("l-user")).toContain("/users/5");

    // La forma nativa (state name pelado, y con puntos + params) sigue funcionando — no la tocamos.
    expect(href("l-name")).toBe($state.href("about"));
    expect(href("l-about")).toBe($state.href("about"));
    expect(href("l-dotted")).toBe($state.href("users.id", { id: "9" }));

    // Un click sobre el `<a ui-sref="/users/5">` navega al estado con sus params.
    document
      .getElementById("l-user")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    // `clickHook` difiere el `$state.go` con `$timeout(0)` (real, sin ngMock).
    await new Promise((resolve) => setTimeout(resolve, 10));
    $rootScope.$digest();
    $rootScope.$digest();
    await Promise.resolve();
    $rootScope.$digest();

    expect($state.current.name).toBe("users.id");
    expect($state.params.id).toBe("5");
    expect(host.textContent).toContain("user");

    // `ui-sref-active` se entera del estado traducido desde la forma URL.
    expect(document.getElementById("l-about")?.classList.contains("is-active")).toBe(false);
    await router.navigateByUrl("/about");
    $rootScope.$digest();
    $rootScope.$digest();
    expect(document.getElementById("l-about")?.classList.contains("is-active")).toBe(true);

    // `ui-sref="tab.to"` (expresión de scope, típico `ng-repeat` con paths dinámicos por item —
    // equivalente a `[routerLink]="tab.to"` de Angular): resuelve y navega igual que la forma estática.
    expect(href("l-tab-1")).toBe($state.href("about"));
    document
      .getElementById("l-tab-0")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    $rootScope.$digest();
    $rootScope.$digest();
    await Promise.resolve();
    $rootScope.$digest();
    expect(host.textContent).toContain("home");

    host.remove();
  });
});
