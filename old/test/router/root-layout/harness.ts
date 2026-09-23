import type angular from "angular";
import { Component } from "@/core/metadata/component.ts";
import { Router } from "@/router/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

/** Piezas compartidas de los tests de layout raíz (`{ path: "", component, children }`). */

@Component({ selector: "rl-root", controllerAs: "$", template: "<ui-view></ui-view>" })
export class RlRoot {}

@Component({
  selector: "rl-shell",
  template: "<nav class='shell'>shell <a id='about' ui-sref='/about'>about</a></nav><ui-view></ui-view>",
})
export class RlShell {}

@Component({ selector: "rl-home", template: "<h1>home</h1>" })
export class RlHome {}

@Component({ selector: "rl-about", template: "<h1>about</h1>" })
export class RlAbout {}

@Component({ selector: "rl-not-found", template: "<h1>not found</h1>" })
export class RlNotFound {}

export async function settle($rootScope: angular.IRootScopeService, nav?: Promise<unknown>): Promise<void> {
  for (let i = 0; i < 25; i++) {
    if (!$rootScope.$$phase) $rootScope.$apply();
    await new Promise((r) => setTimeout(r));
  }
  await nav;
}

export async function bootAt(appModule: Function, url: string) {
  window.history.pushState(null, "", url);
  const host = document.createElement("rl-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(appModule, { hostElement: host });
  const injector = appRef.injector as angular.auto.IInjectorService;
  const $rootScope = injector.get<angular.IRootScopeService>("$rootScope");
  await settle($rootScope);
  return { host, appRef, injector, $rootScope, router: injector.get<Router>(Router.$name) };
}

export function resetDom(): void {
  document.body.innerHTML = "";
  window.history.pushState(null, "", "/");
}
