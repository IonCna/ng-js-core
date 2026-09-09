import "@uirouter/angularjs";
import type { StateProvider, StateService, Transition, TransitionService } from "@uirouter/angularjs";
import angular, { type ILocationProvider, type ILocationService, type IRootScopeService } from "angular";
import {
  HashLocationStrategy,
  LocationStrategy,
  PathLocationStrategy,
  PlatformLocation,
} from "@/common/location/index.ts";
import { ViewportScroller } from "@/common/viewport-scroller.ts";
import { Title } from "@/platform-browser/title.ts";
import { ActivatedRoute, ActivatedRouteImpl } from "@/router/activated-route.ts";
import type { Data, ResolveFn, Routes } from "@/router/route.ts";
import { mergeResolvedData, pickRouteTitle } from "@/router/route-title.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import { Router, RouterImpl } from "@/router/router.ts";
import {
  type DeactivateBinding,
  type GuardBinding,
  type MatchBinding,
  resolveRedirect,
  routesToStates,
  type TranslatedRoutes,
  wireDeactivateHook,
  wireGuardHook,
  wireMatchHook,
} from "@/router/state-translator.ts";
import { DefaultTitleStrategy, TitleStrategy } from "@/router/title-strategy.ts";
import { commonModule } from "@/runtime/common/index.ts";

let moduleSeq = 0;

function nextModuleName(prefix: string): string {
  moduleSeq += 1;
  return `${prefix}.${moduleSeq}`;
}

/**
 * Un `$injector` por cada `forRoot` activo — el guard "forRoot llamado dos veces"
 * de `@angular/router` (`ROUTER_FORROOT_GUARD`). Es por inyector, no por llamada:
 * cada `bootstrapApplication` tiene su `$injector`, así que un helper de tests que
 * arma varias apps no dispara el error; dos `forRoot` en la MISMA app sí.
 */
const forRootInjectors = new WeakSet<object>();

/**
 * Re-resuelve los `redirectTo` de `translated` contra el `pathToName` **global**
 * (todos los árboles de `forRoot` + `forChild`), no solo el árbol propio. Corre
 * en fase config, cuando todos los `forRoot`/`forChild` ya poblaron el registro.
 */
function applyGlobalRedirects(translated: TranslatedRoutes): void {
  for (const { state, redirectTo, parentPath } of translated.redirects) {
    state.redirectTo = resolveRedirect(redirectTo, parentPath, routerRegistry.pathToName);
  }
}

interface UrlRouterProvider {
  otherwise(rule: string | ((...args: unknown[]) => string)): void;
}

// --- Features (estilo `provideRouter(routes, ...features)` de Angular) -------

/** Opciones de `withInMemoryScrolling()` — misma forma que `@angular/router`. */
export interface InMemoryScrollingOptions {
  /**
   * `'disabled'` (default) · `'top'` (scroll a `[0,0]` en cada nav) ·
   * `'enabled'` (restaurar en back/forward). **`'enabled'` no está soportado
   * sobre UI-Router** — se degrada a `'top'`. Ver brecha.
   */
  scrollPositionRestoration?: "disabled" | "enabled" | "top";
  /** `'enabled'` → tras navegar, scroll al elemento del `#fragment`. */
  anchorScrolling?: "disabled" | "enabled";
}

interface RouterFeature {
  readonly ɵkind: "hash-location" | "in-memory-scrolling";
  readonly options?: InMemoryScrollingOptions;
}

/**
 * Feature para `RouterModule.forRoot(routes, withHashLocation())` — mismo nombre y
 * semántica que `@angular/router`. Hace dos cosas:
 *  1. registra `{ provide: LocationStrategy, useClass: HashLocationStrategy }`
 *     (URLs `#/about`; sin el feature → `PathLocationStrategy`, `/about`);
 *  2. pone `$locationProvider.html5Mode(false)` — UI-Router (el sustrato) lee la
 *     URL de `$location`, así que necesita el modo hashbang para coincidir.
 */
export function withHashLocation(): RouterFeature {
  return { ɵkind: "hash-location" };
}

/**
 * Feature para `RouterModule.forRoot(routes, withInMemoryScrolling(opts))` —
 * mismo nombre que `@angular/router`. Soporta `anchorScrolling: 'enabled'`
 * (scroll al `#fragment`), `scrollPositionRestoration: 'top'` y `'enabled'`
 * (guarda la posición por URL y la restaura en back/forward — el trigger de
 * back/forward se infiere escuchando `popstate` en `window`, porque UI-Router no
 * lo expone). **Matiz vs Angular:** el store es por URL, así que también restaura
 * al volver a una URL ya visitada por un link (no solo con el botón atrás). No
 * se emite el evento `Scroll` en `Router.events`.
 */
export function withInMemoryScrolling(options: InMemoryScrollingOptions = {}): RouterFeature {
  return { ɵkind: "in-memory-scrolling", options };
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

function wireTitles(titles: Map<string, string | ResolveFn<string>>, resolveKeys: Map<string, string[]>) {
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
 * `withInMemoryScrolling()` → `.run`. El scroll se difiere con `$timeout(0)`
 * porque el `<ui-view>` nuevo se linkea recién después de `onSuccess`.
 * Prioridad: posición restaurada (back/forward con `'enabled'`) → `#fragment`
 * (`anchorScrolling`) → `[0,0]` (`'top'`/`'enabled'` yendo adelante).
 *
 * `'enabled'`: se guarda `getScrollPosition()` por URL en `onBefore` (la página
 * que se deja) y se restaura en `onSuccess` si la nav fue un `popstate`
 * (`window` popstate → `pendingPop`, consumido en el próximo `onSuccess`).
 */
function wireRouterScroller(options: InMemoryScrollingOptions) {
  const restoration = options.scrollPositionRestoration ?? "disabled";
  const anchorScrolling = options.anchorScrolling ?? "disabled";
  const restoreEnabled = restoration === "enabled";

  const run = (
    viewportScroller: ViewportScroller,
    platformLocation: PlatformLocation,
    $transitions: TransitionService,
    $location: ILocationService,
    $timeout: angular.ITimeoutService,
    $rootScope: IRootScopeService,
  ) => {
    if (restoration !== "disabled") viewportScroller.setHistoryScrollRestoration("manual");

    const store = new Map<string, [number, number]>();
    let lastUrl: string | undefined;
    let pendingPop = false;

    if (restoreEnabled) {
      const offPop = platformLocation.onPopState(() => {
        pendingPop = true;
      });
      $rootScope.$on("$destroy", offPop);
      $transitions.onError({}, () => {
        pendingPop = false;
      });
    }

    $transitions.onBefore({}, () => {
      if (restoreEnabled && lastUrl !== undefined) {
        store.set(lastUrl, viewportScroller.getScrollPosition());
      }
    });

    $transitions.onSuccess({}, () => {
      const url = $location.url();
      const anchor = anchorScrolling === "enabled" ? $location.hash() || null : null;
      const restored = restoreEnabled && pendingPop ? store.get(url) : undefined;
      pendingPop = false;
      lastUrl = url;

      $timeout(() => {
        if (restored) viewportScroller.scrollToPosition(restored);
        else if (anchor) viewportScroller.scrollToAnchor(anchor);
        else if (restoration === "top" || restoration === "enabled") viewportScroller.scrollToPosition([0, 0]);
      }, 0);
    });
  };
  run.$inject = [ViewportScroller.$name, PlatformLocation.$name, "$transitions", "$location", "$timeout", "$rootScope"];
  return run;
}

/**
 * `RouterModule.forRoot(routes, ...features)` / `forChild(routes)` — devuelven un
 * `angular.IModule` (que `@NgModule({ imports: [...] })` acepta como tal). Traduce
 * las `Routes` (path-based, API de Angular) al árbol de estados con nombre de UI-Router.
 */
export const RouterModule = {
  forRoot(routes: Routes, ...features: RouterFeature[]): angular.IModule {
    const translated = routesToStates(routes, /* isRoot */ true);
    const { states, guards, deactivateGuards, matchGuards, titles, resolveKeys } = translated;

    // El árbol de `forRoot` entra al registro global. Los `Map`s del registro son
    // los que leen `wireTitles` y `ActivatedRoute` — así los `title` / resolvers
    // de rutas de `forChild` (que se suman al mismo registro) también cuentan.
    routerRegistry.mergeTitles(titles);
    routerRegistry.mergeResolveKeys(resolveKeys);
    routerRegistry.mergePathToName(translated.pathToName);

    const root = states.find((state) => !state.name?.includes("."));
    // El root (con componente o con `redirectTo`) matchea la carga inicial en `/`.
    if (root && (root.url === "" || root.url === undefined)) root.url = "/";
    const fallbackUrl = (typeof root?.url === "string" && root.url) || "/";

    const useHash = hashRequested(features);
    // El router depende de `@angular/common` (`ng.js.common`): trae `PlatformLocation`
    // + `APP_BASE_HREF` + `Location` + `DOCUMENT`. `LocationStrategy` la fija acá abajo.
    commonModule();
    const mod = angular.module(nextModuleName("ngjs.router"), ["ui.router", "ng.js.common"]);
    routerRegistry.registerModuleName(mod.name); // para heredar el `controllerAs` del @NgModule que lo importa

    // `@angular/common` no da un `LocationStrategy` por default — lo elige el router
    // según `withHashLocation()`.
    mod.service(LocationStrategy.$name, useHash ? HashLocationStrategy : PathLocationStrategy);

    const config = (
      $stateProvider: StateProvider,
      $urlRouterProvider: UrlRouterProvider,
      $locationProvider: ILocationProvider,
    ) => {
      // Default = PathLocationStrategy (html5), como Angular. `withHashLocation()` → hashbang.
      if (!useHash) {
        $locationProvider.html5Mode({ enabled: true, requireBase: false });
      }
      applyGlobalRedirects(translated); // redirects cruzados forRoot↔forChild — el registro ya está completo
      for (const state of states) $stateProvider.state({ ...state }); // clon: UI-Router muta la decl (quita lazyLoad); no compartir entre bootstraps

      // La ruta `**` (si hay) matchea via su param greedy `/{ngjsCatchAll:.+}`.
      // `otherwise` solo cubre la URL raíz sin match → va a la raíz.
      $urlRouterProvider.otherwise(fallbackUrl);
    };
    config.$inject = ["$stateProvider", "$urlRouterProvider", "$locationProvider"];

    mod.config(config);

    // Guard "forRoot llamado dos veces" — por `$injector` (una app), no por llamada.
    const forRootGuard = ($injector: angular.auto.IInjectorService) => {
      if (forRootInjectors.has($injector)) {
        throw new Error(
          "RouterModule.forRoot() se llamó dos veces en la misma app. Usá RouterModule.forChild() en los feature modules.",
        );
      }
      forRootInjectors.add($injector);
    };
    forRootGuard.$inject = ["$injector"];
    mod.run(forRootGuard);

    if (guards.length) mod.run(wireGuards(guards));
    if (deactivateGuards.length) mod.run(wireDeactivateGuards(deactivateGuards));
    if (matchGuards.length) mod.run(wireMatchGuards(matchGuards));
    // Lee el registro global (no los `Map`s locales): `forChild` y `loadChildren`
    // le agregan títulos/resolvers después, y `wireTitles` los ve en cada transición.
    mod.run(wireTitles(routerRegistry.titles, routerRegistry.resolveKeys));

    const scrollFeature = features.find((f) => f.ɵkind === "in-memory-scrolling");
    if (scrollFeature) mod.run(wireRouterScroller(scrollFeature.options ?? {}));

    mod.service(Router.$name, RouterImpl);

    const activatedRouteFactory = (
      $state: StateService,
      $transitions: TransitionService,
      $location: ILocationService,
      $rootScope: IRootScopeService,
    ) =>
      new ActivatedRouteImpl(
        $state,
        $transitions,
        $location,
        $rootScope,
        routerRegistry.titles,
        routerRegistry.resolveKeys,
      );
    activatedRouteFactory.$inject = ["$state", "$transitions", "$location", "$rootScope"];
    mod.factory(ActivatedRoute.$name, activatedRouteFactory);

    return mod;
  },

  forChild(routes: Routes): angular.IModule {
    const translated = routesToStates(routes);
    const { states, guards, deactivateGuards, matchGuards, titles, resolveKeys } = translated;

    // Mismo registro global que `forRoot`: así `title`, `canDeactivate`, `canMatch`
    // y la `data` resuelta de estas rutas dejan de perderse (los leen el
    // `wireTitles` / `ActivatedRoute` del módulo de `forRoot`), y sus paths
    // entran al `pathToName` para los `redirectTo` cruzados.
    routerRegistry.mergeTitles(titles);
    routerRegistry.mergeResolveKeys(resolveKeys);
    routerRegistry.mergePathToName(translated.pathToName);

    const mod = angular.module(nextModuleName("ngjs.router.child"), ["ui.router"]);
    routerRegistry.registerModuleName(mod.name);

    const config = ($stateProvider: StateProvider) => {
      applyGlobalRedirects(translated);
      for (const state of states) $stateProvider.state({ ...state }); // clon: UI-Router muta la decl (quita lazyLoad); no compartir entre bootstraps
    };
    config.$inject = ["$stateProvider"];

    mod.config(config);
    if (guards.length) mod.run(wireGuards(guards));
    if (deactivateGuards.length) mod.run(wireDeactivateGuards(deactivateGuards));
    if (matchGuards.length) mod.run(wireMatchGuards(matchGuards));

    return mod;
  },
};
