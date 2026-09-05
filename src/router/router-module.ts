import "@uirouter/angularjs";
import type { StateProvider, StateService, TransitionService } from "@uirouter/angularjs";
import angular, {
  type IAttributes,
  type IDirective,
  type ILocationProvider,
  type ILocationService,
  type IRootScopeService,
} from "angular";
import { ActivatedRoute, ActivatedRouteImpl } from "@/router/activated-route.ts";
import type { ResolveFn, Routes } from "@/router/route.ts";
import { Router, RouterImpl } from "@/router/router.ts";
import { routerLinkActiveDirective, routerLinkDirective } from "@/router/router-link.ts";
import { type GuardBinding, routesToStates } from "@/router/state-translator.ts";

let moduleSeq = 0;

function nextModuleName(prefix: string): string {
  moduleSeq += 1;
  return `${prefix}.${moduleSeq}`;
}

interface UrlRouterProvider {
  otherwise(rule: string | ((...args: unknown[]) => string)): void;
}

// --- Features (estilo `provideRouter(routes, ...features)` de Angular) -------

interface RouterFeature {
  readonly ɵkind: "hash-location";
}

/**
 * Feature para `RouterModule.forRoot(routes, withHashLocation())` — mismo nombre y
 * semántica que `@angular/router`: activa el `HashLocationStrategy` (URLs `#/about`).
 * Sin este feature el router usa el equivalente a `PathLocationStrategy`
 * (`$locationProvider.html5Mode`, URLs `/about`), que es el default de Angular.
 */
export function withHashLocation(): RouterFeature {
  return { ɵkind: "hash-location" };
}

// --- Wiring interno --------------------------------------------------------

function wireGuards(guards: GuardBinding[]) {
  const run = ($transitions: TransitionService) => {
    for (const guard of guards) {
      // `canActivateChild` → glob `parent.**` (parent + descendientes); se saltea el parent en sí.
      const criteria = guard.forChildren ? { to: `${guard.stateName}.**` } : { to: guard.stateName };
      $transitions.onBefore(criteria, async (transition) => {
        if (guard.forChildren && transition.to().name === guard.stateName) return true;
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

function wireTitles(titles: Map<string, string | ResolveFn<string>>) {
  const run = ($transitions: TransitionService, $state: StateService) => {
    $transitions.onSuccess({}, async () => {
      // Estado activo más profundo con `title` definido.
      const chain = ($state.$current as unknown as { path?: { name: string }[] }).path ?? [];
      let title: string | ResolveFn<string> | undefined;
      for (const node of chain) {
        const candidate = titles.get(node.name);
        if (candidate !== undefined) title = candidate;
      }
      if (title === undefined) return;

      const resolved =
        typeof title === "function"
          ? await title({ params: { ...($state.params as Record<string, string>) }, data: {} })
          : title;
      if (typeof resolved === "string") document.title = resolved;
    });
  };
  run.$inject = ["$transitions", "$state"];
  return run;
}

function routerOutletDirective(): IDirective {
  return {
    restrict: "E",
    // `<router-outlet name="aux">` → `<ui-view name="aux">` (outlets con nombre de UI-Router).
    template: (_tElement: unknown, tAttrs: IAttributes): string => {
      const name = String((tAttrs as IAttributes & { name?: string }).name ?? "").replace(/[^\w-]/g, "");
      return name ? `<ui-view name="${name}"></ui-view>` : "<ui-view></ui-view>";
    },
  };
}

function hashRequested(features: RouterFeature[]): boolean {
  return features.some((f) => f.ɵkind === "hash-location");
}

/**
 * `RouterModule.forRoot(routes, ...features)` / `forChild(routes)` — devuelven un
 * `angular.IModule` (que `@NgModule({ imports: [...] })` acepta como tal). Traduce
 * las `Routes` (path-based, API de Angular) al árbol de estados con nombre de UI-Router.
 */
export const RouterModule = {
  forRoot(routes: Routes, ...features: RouterFeature[]): angular.IModule {
    const translated = routesToStates(routes);
    const { states, guards, titles, resolveKeys } = translated;

    const root = states.find((state) => !state.name?.includes("."));
    // El root (con componente o con `redirectTo`) matchea la carga inicial en `/`.
    if (root && (root.url === "" || root.url === undefined)) root.url = "/";
    const fallbackUrl = (typeof root?.url === "string" && root.url) || "/";

    const mod = angular.module(nextModuleName("ngjs.router"), ["ui.router"]);

    const config = (
      $stateProvider: StateProvider,
      $urlRouterProvider: UrlRouterProvider,
      $locationProvider: ILocationProvider,
    ) => {
      // Default = PathLocationStrategy (html5), como Angular. `withHashLocation()` → hashbang.
      if (!hashRequested(features)) {
        $locationProvider.html5Mode({ enabled: true, requireBase: false });
      }
      for (const state of states) $stateProvider.state(state);

      // La ruta `**` (si hay) matchea via su param greedy `/{ngjsCatchAll:.+}`.
      // `otherwise` solo cubre la URL raíz sin match → va a la raíz.
      $urlRouterProvider.otherwise(fallbackUrl);
    };
    config.$inject = ["$stateProvider", "$urlRouterProvider", "$locationProvider"];

    mod.config(config);
    if (guards.length) mod.run(wireGuards(guards));
    if (titles.size) mod.run(wireTitles(titles));
    mod.directive("routerOutlet", routerOutletDirective);
    mod.directive("routerLink", routerLinkDirective);
    mod.directive("routerLinkActive", routerLinkActiveDirective);
    mod.service(Router.$name, RouterImpl);

    const activatedRouteFactory = (
      $state: StateService,
      $transitions: TransitionService,
      $location: ILocationService,
      $rootScope: IRootScopeService,
    ) => new ActivatedRouteImpl($state, $transitions, $location, $rootScope, titles, resolveKeys);
    activatedRouteFactory.$inject = ["$state", "$transitions", "$location", "$rootScope"];
    mod.factory(ActivatedRoute.$name, activatedRouteFactory);

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
