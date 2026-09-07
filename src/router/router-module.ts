import "@uirouter/angularjs";
import type { StateProvider, StateService, Transition, TransitionService } from "@uirouter/angularjs";
import angular, { type ILocationProvider, type ILocationService, type IRootScopeService } from "angular";
import { Title } from "@/platform-browser/title.ts";
import { ActivatedRoute, ActivatedRouteImpl } from "@/router/activated-route.ts";
import type { Data, ResolveFn, Routes } from "@/router/route.ts";
import { mergeResolvedData, pickRouteTitle } from "@/router/route-title.ts";
import { Router, RouterImpl } from "@/router/router.ts";
import { DefaultTitleStrategy, TitleStrategy } from "@/router/title-strategy.ts";
import {
  type DeactivateBinding,
  type GuardBinding,
  type MatchBinding,
  routesToStates,
  wireDeactivateHook,
  wireGuardHook,
  wireMatchHook,
} from "@/router/state-translator.ts";

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
    for (const guard of guards) wireGuardHook($transitions, guard);
  };
  run.$inject = ["$transitions"];
  return run;
}

function wireDeactivateGuards(bindings: DeactivateBinding[]) {
  const run = ($transitions: TransitionService) => {
    for (const binding of bindings) wireDeactivateHook($transitions, binding);
  };
  run.$inject = ["$transitions"];
  return run;
}

function wireMatchGuards(bindings: MatchBinding[]) {
  const run = ($transitions: TransitionService) => {
    for (const binding of bindings) wireMatchHook($transitions, binding);
  };
  run.$inject = ["$transitions"];
  return run;
}

function wireTitles(
  titles: Map<string, string | ResolveFn<string>>,
  resolveKeys: Map<string, string[]>,
) {
  const run = (
    $transitions: TransitionService,
    $state: StateService,
    $location: ILocationService,
    $injector: angular.auto.IInjectorService,
  ) => {
    // `TitleStrategy` custom (`{ provide: TitleStrategy, useClass }` en un `@NgModule`) o el default.
    const strategy: TitleStrategy = $injector.has(TitleStrategy.$name)
      ? $injector.get<TitleStrategy>(TitleStrategy.$name)
      : new DefaultTitleStrategy($injector.has(Title.$name) ? $injector.get<Title>(Title.$name) : undefined);

    $transitions.onSuccess({}, async (transition: Transition) => {
      // Estado activo más profundo con `title` definido.
      const chain = ($state.$current as unknown as { path?: { name: string }[] }).path ?? [];
      const picked = pickRouteTitle(chain, titles);
      if (picked === undefined) return;

      let resolved: string | undefined;
      if (typeof picked === "function") {
        // Mismo contexto que recibe `ActivatedRoute.title` (params + data mergeada + query + fragment).
        const params = { ...($state.params as Record<string, string>) };
        const staticData = (($state.$current as unknown as { data?: Data }).data ?? {}) as Data;
        const data = mergeResolvedData(chain, resolveKeys, staticData, transition.injector());
        const value = await picked({
          params,
          data,
          queryParams: { ...($location.search() as Record<string, string>) },
          fragment: $location.hash() || null,
        });
        if (typeof value === "string") resolved = value;
      } else {
        resolved = picked;
      }

      if (resolved !== undefined) strategy.updateTitle(resolved);
    });
  };
  run.$inject = ["$transitions", "$state", "$location", "$injector"];
  return run;
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
    const { states, guards, deactivateGuards, matchGuards, titles, resolveKeys } = translated;

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
      for (const state of states) $stateProvider.state({ ...state }); // clon: UI-Router muta la decl (quita lazyLoad); no compartir entre bootstraps

      // La ruta `**` (si hay) matchea via su param greedy `/{ngjsCatchAll:.+}`.
      // `otherwise` solo cubre la URL raíz sin match → va a la raíz.
      $urlRouterProvider.otherwise(fallbackUrl);
    };
    config.$inject = ["$stateProvider", "$urlRouterProvider", "$locationProvider"];

    mod.config(config);
    if (guards.length) mod.run(wireGuards(guards));
    if (deactivateGuards.length) mod.run(wireDeactivateGuards(deactivateGuards));
    if (matchGuards.length) mod.run(wireMatchGuards(matchGuards));
    // Siempre — `loadChildren` puede agregar títulos al `Map` después (lo lee en cada transición).
    mod.run(wireTitles(titles, resolveKeys));
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
      for (const state of states) $stateProvider.state({ ...state }); // clon: UI-Router muta la decl (quita lazyLoad); no compartir entre bootstraps
    };
    config.$inject = ["$stateProvider"];

    mod.config(config);
    if (guards.length) mod.run(wireGuards(guards));

    return mod;
  },
};
