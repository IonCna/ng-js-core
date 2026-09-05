import "@uirouter/angularjs";
import type { StateProvider, TransitionService } from "@uirouter/angularjs";
import angular from "angular";
import { ActivatedRoute, ActivatedRouteImpl } from "@/router/activated-route.ts";
import type { Routes } from "@/router/route.ts";
import { Router, RouterImpl } from "@/router/router.ts";
import { type GuardBinding, routesToStates } from "@/router/state-translator.ts";

let moduleSeq = 0;

function nextModuleName(prefix: string): string {
  moduleSeq += 1;
  return `${prefix}.${moduleSeq}`;
}

interface UrlRouterProvider {
  otherwise(rule: string | ((...args: unknown[]) => string)): void;
}

function wireGuards(guards: GuardBinding[]) {
  const run = ($transitions: TransitionService) => {
    for (const guard of guards) {
      $transitions.onBefore({ to: guard.stateName }, async (transition) => {
        const snapshot = { params: transition.params() as Record<string, string>, data: guard.data };
        for (const canActivate of guard.canActivate) {
          if ((await canActivate(snapshot)) === false) return false;
        }
        return true;
      });
    }
  };
  run.$inject = ["$transitions"];
  return run;
}

function routerOutletDirective() {
  return { restrict: "E" as const, template: "<ui-view></ui-view>" };
}

/**
 * `RouterModule.forRoot(routes)` / `forChild(routes)` — devuelven un `angular.IModule`
 * (que `@NgModule({ imports: [...] })` acepta como tal). Traduce las `Routes`
 * (path-based, API de Angular) al árbol de estados con nombre de UI-Router.
 */
export const RouterModule = {
  forRoot(routes: Routes): angular.IModule {
    const { states, guards } = routesToStates(routes);
    const root = states.find((state) => !state.name?.includes("."));
    if (root && (root.url === "" || root.url === undefined)) root.url = "/";

    const mod = angular.module(nextModuleName("ngjs.router"), ["ui.router"]);

    const config = ($stateProvider: StateProvider, $urlRouterProvider: UrlRouterProvider) => {
      for (const state of states) $stateProvider.state(state);
      $urlRouterProvider.otherwise((typeof root?.url === "string" && root.url) || "/");
    };
    config.$inject = ["$stateProvider", "$urlRouterProvider"];

    mod.config(config);
    if (guards.length) mod.run(wireGuards(guards));
    mod.directive("routerOutlet", routerOutletDirective);
    mod.service(Router.$name, RouterImpl);
    mod.service(ActivatedRoute.$name, ActivatedRouteImpl);

    return mod;
  },

  forChild(routes: Routes): angular.IModule {
    const { states, guards } = routesToStates(routes);
    const mod = angular.module(nextModuleName("ngjs.router.child"), ["ui.router"]);

    const config = ($stateProvider: StateProvider) => {
      for (const state of states) $stateProvider.state(state);
    };
    config.$inject = ["$stateProvider"];

    mod.config(config);
    if (guards.length) mod.run(wireGuards(guards));

    return mod;
  },
};
