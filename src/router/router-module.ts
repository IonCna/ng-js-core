import "@uirouter/angularjs";
import type { StateProvider, StateService, Transition, TransitionService } from "@uirouter/angularjs";
import angular, { type ILocationProvider, type ILocationService, type IRootScopeService } from "angular";
import { CommonModule } from "@/common/common.module.ts";
import {
  HashLocationStrategy,
  LocationStrategy,
  PathLocationStrategy,
  PlatformLocation,
} from "@/common/location/index.ts";
import { ViewportScroller } from "@/common/viewport-scroller.ts";
import { injectionTokenName } from "@/core/di/injector.ts";
import { RuntimeProviders } from "@/core/di/runtime-providers.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import { Title } from "@/platform-browser/title.ts";
import { ActivatedRoute, ActivatedRouteImpl } from "@/router/activated-route.ts";
import { type PreloadingStrategyType, RouterPreloader } from "@/router/preloading.ts";
import type { Data, ResolveFn, Routes } from "@/router/route.ts";
import {
  mergeResolvedData,
  mergeStaticData,
  type ParamsInheritanceStrategy,
  pickRouteTitle,
  pickRouteTitleState,
} from "@/router/route-title.ts";
import { Router, RouterImpl } from "@/router/router.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import {
  type DeactivateBinding,
  type GuardBinding,
  type MatchBinding,
  redirectTargetFor,
  routesToStates,
  runInRouteContext,
  type TranslatedRoutes,
  wireDeactivateHook,
  wireGuardHook,
  wireLazyRoutes,
  wireMatchHook,
} from "@/router/state-translator.ts";
import { DefaultTitleStrategy, TitleStrategy } from "@/router/title-strategy.ts";
import { decorateUiSrefWithUrl } from "@/router/ui-sref-url.ts";

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
    state.redirectTo = redirectTargetFor(redirectTo, parentPath, routerRegistry.pathToName) as never;
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

/** Opciones de `withRouterConfig()` — mismo nombre/forma que `@angular/router`. */
export interface RouterConfigOptions {
  /**
   * Mismo nombre/semántica que Angular. `'emptyOnly'` (default) = un hijo
   * hereda `data`/params del padre solo si su propio `path` es `""` (ruta
   * contenedora sin URL propia, el idiom `{ path: "", children: [...] }`).
   * `'always'` = cualquier hijo hereda `data`/params de toda la cadena de
   * ancestros, sin importar el `path`.
   */
  paramsInheritanceStrategy?: ParamsInheritanceStrategy;
}

interface RouterFeature {
  readonly ɵkind: "hash-location" | "in-memory-scrolling" | "router-config" | "preloading";
  readonly options?: InMemoryScrollingOptions | RouterConfigOptions;
  readonly strategy?: PreloadingStrategyType;
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

/**
 * Feature para `RouterModule.forRoot(routes, withRouterConfig(opts))` — mismo
 * nombre que `@angular/router`. Hoy solo cubre `paramsInheritanceStrategy`
 * (ver `mergeStaticData`); el resto de las opciones de Angular quedan fuera
 * del MVP.
 */
export function withRouterConfig(options: RouterConfigOptions = {}): RouterFeature {
  return { ɵkind: "router-config", options };
}

/**
 * Feature para `RouterModule.forRoot(routes, withPreloading(PreloadAllModules))` —
 * mismo nombre que `@angular/router`. Después de cada navegación exitosa, la
 * estrategia decide qué rutas `loadChildren`/`loadComponent` bajar por adelantado
 * (ver `RouterPreloader`). La clase se instancia con DI de constructor.
 */
export function withPreloading(strategy: PreloadingStrategyType): RouterFeature {
  return { ɵkind: "preloading", strategy };
}

// --- Wiring interno --------------------------------------------------------

function wirePreloading(strategy: PreloadingStrategyType) {
  const run = ($transitions: TransitionService, $injector: angular.auto.IInjectorService) => {
    const preloader = RouterPreloader.create(strategy, $injector);
    // Diferido a un microtask: la precarga registra estados y no tiene por qué
    // correr dentro del hook de la transición que acaba de terminar.
    $transitions.onSuccess({}, () => {
      void Promise.resolve().then(() => preloader.preload());
    });
  };
  run.$inject = ["$transitions", "$injector"];
  return run;
}

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
  emptyPathStates: Set<string>,
  paramsInheritanceStrategy: ParamsInheritanceStrategy,
) {
  const run = (
    $transitions: TransitionService,
    $state: StateService,
    $location: ILocationService,
    $injector: angular.auto.IInjectorService,
  ) => {
    // `TitleStrategy` custom (`{ provide: TitleStrategy, useClass }` en un `@NgModule`) o el default.
    const strategyName = injectionTokenName(TitleStrategy);
    const titleName = injectionTokenName(Title);
    const strategy: TitleStrategy = $injector.has(strategyName)
      ? $injector.get<TitleStrategy>(strategyName)
      : new DefaultTitleStrategy($injector.has(titleName) ? $injector.get<Title>(titleName) : undefined);

    $transitions.onSuccess({}, async (transition: Transition) => {
      // Estado activo más profundo con `title` definido.
      const chain = ($state.$current as unknown as { path?: { name: string; data?: Data }[] }).path ?? [];
      const picked = pickRouteTitle(chain, titles);
      if (picked === undefined) return;
      const titleState = pickRouteTitleState(chain, titles) as string;

      let resolved: string | undefined;
      if (typeof picked === "function") {
        // Mismo contexto que recibe `ActivatedRoute.title` (params + data mergeada + query + fragment).
        const params = { ...($state.params as Record<string, string>) };
        const staticData = mergeStaticData(chain, emptyPathStates, paramsInheritanceStrategy);
        const data = mergeResolvedData(chain, resolveKeys, staticData, transition.injector());
        const value = await runInRouteContext($injector, titleState, () =>
          picked({
            params,
            data,
            queryParams: { ...($location.search() as Record<string, string>) },
            fragment: $location.hash() || null,
          }),
        );
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
  run.$inject = [
    injectionTokenName(ViewportScroller),
    injectionTokenName(PlatformLocation),
    "$transitions",
    "$location",
    "$timeout",
    "$rootScope",
  ];
  return run;
}

/**
 * `RouterModule.forRoot(routes, ...features)` / `forChild(routes)` — devuelven un
 * `angular.IModule` (que `@NgModule({ imports: [...] })` acepta como tal). Traduce
 * las `Routes` (path-based, API de Angular) al árbol de estados con nombre de UI-Router.
 */
export const RouterModule = {
  /** `imports: [RouterModule]` (sin `forRoot`/`forChild`): trae `ui.router` (directivas `ui-sref`/`ui-view`). */
  name: "ui.router",

  forRoot(routes: Routes, ...features: RouterFeature[]): angular.IModule {
    const translated = routesToStates(routes, /* isRoot */ true);
    const { states, guards, deactivateGuards, matchGuards, titles, resolveKeys } = translated;

    // El árbol de `forRoot` entra al registro global. Los `Map`s del registro son
    // los que leen `wireTitles` y `ActivatedRoute` — así los `title` / resolvers
    // de rutas de `forChild` (que se suman al mismo registro) también cuentan.
    routerRegistry.mergeTitles(titles);
    routerRegistry.mergeResolveKeys(resolveKeys);
    routerRegistry.mergeEmptyPathStates(translated.emptyPathStates);
    routerRegistry.mergeLazyChildrenStates(translated.lazyChildrenStates);
    routerRegistry.mergeRouteProviders(translated.routeProviders);
    routerRegistry.mergePathToName(translated.pathToName);

    const configFeature = features.find((f) => f.ɵkind === "router-config");
    const paramsInheritanceStrategy: ParamsInheritanceStrategy =
      (configFeature?.options as RouterConfigOptions | undefined)?.paramsInheritanceStrategy ?? "emptyOnly";

    // La URL `/` de la raíz la asigna el traductor (hoja de la cadena `path: ""`); acá no
    // se fuerza: un layout raíz con hijos lleva `url: ""` a propósito (ver `walk`).
    const root = states.find((state) => !state.name?.includes("."));
    const fallbackUrl = (typeof root?.url === "string" && root.url) || "/";

    const useHash = hashRequested(features);
    // El router depende de `@angular/common` (`CommonModule`): trae `PlatformLocation` + `APP_BASE_HREF` +
    // `Location`. `LocationStrategy` la fija acá abajo.
    const commonId = (CommonModule as unknown as { ɵmod: { id: string } }).ɵmod.id;
    const mod = angular.module(nextModuleName("ngjs.router"), ["ui.router", commonId]);
    routerRegistry.registerModuleName(mod.name);

    // `@angular/common` no da un `LocationStrategy` por default — lo elige el router según `withHashLocation()`.
    const Strategy = useHash ? HashLocationStrategy : PathLocationStrategy;
    mod.factory(injectionTokenName(LocationStrategy), (Strategy as unknown as { ɵfac: unknown[] }).ɵfac as never);
    // `Route.providers`: AngularJS tiene un solo injector — quedan para toda la app.
    if (translated.routeProviders.size) {
      const registerProviders = ($provide: angular.auto.IProvideService) => {
        for (const providers of translated.routeProviders.values()) RuntimeProviders.register($provide, providers);
      };
      registerProviders.$inject = ["$provide"];
      mod.config(registerProviders);
    }

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

    // `ui-sref` acepta también la forma URL (`/algo`), no solo el state name — se
    // traduce contra la misma config (ver `ui-sref-url.ts`). Solo en `forRoot`:
    // la directiva es global y `forChild` comparte el mismo `ui.router`.
    const srefUrlConfig = ($provide: angular.auto.IProvideService) => decorateUiSrefWithUrl($provide);
    srefUrlConfig.$inject = ["$provide"];
    mod.config(srefUrlConfig);

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
    mod.run(
      wireTitles(
        routerRegistry.titles,
        routerRegistry.resolveKeys,
        routerRegistry.emptyPathStates,
        paramsInheritanceStrategy,
      ),
    );

    if (translated.lazyRoutes.length) mod.run(wireLazyRoutes(translated.lazyRoutes));
    const preloadingFeature = features.find((f) => f.ɵkind === "preloading");
    if (preloadingFeature?.strategy) mod.run(wirePreloading(preloadingFeature.strategy));

    const scrollFeature = features.find((f) => f.ɵkind === "in-memory-scrolling");
    if (scrollFeature)
      mod.run(wireRouterScroller((scrollFeature.options as InMemoryScrollingOptions | undefined) ?? {}));

    mod.factory(injectionTokenName(Router), (RouterImpl as unknown as { ɵfac: unknown[] }).ɵfac as never);

    const activatedRouteFactory = (
      $state: StateService,
      $transitions: TransitionService,
      $location: ILocationService,
      $rootScope: IRootScopeService,
      $injector: angular.auto.IInjectorService,
    ) =>
      new ActivatedRouteImpl(
        $state,
        $transitions,
        $location,
        $rootScope,
        routerRegistry.titles,
        routerRegistry.resolveKeys,
        routerRegistry.emptyPathStates,
        paramsInheritanceStrategy,
        $injector,
      );
    activatedRouteFactory.$inject = ["$state", "$transitions", "$location", "$rootScope", "$injector"];
    mod.factory(injectionTokenName(ActivatedRoute), activatedRouteFactory);

    return mod;
  },

  forChild(routes: Routes): angular.IModule {
    const translated = routesToStates(routes);
    const { states, guards, deactivateGuards, matchGuards, titles, resolveKeys } = translated;

    // Mismo registro global que `forRoot`: así `title`, `canDeactivate`, `canMatch`
    // y la `data` resuelta de estas rutas dejan de perderse (los leen el
    // `wireTitles` / `ActivatedRoute` del módulo de `forRoot`), y sus paths
    // entran al `pathToName` para los `redirectTo` cruzados.
    // Después del bootstrap (`forChild` dentro de un chunk de `loadChildren`) NO:
    // acá los nombres/paths serían de raíz; `loadChildren` re-traduce estas
    // `Routes` rooteadas en la ruta padre y mergea eso.
    if (!ConfigProviderFactory.current) {
      routerRegistry.mergeTitles(titles);
      routerRegistry.mergeResolveKeys(resolveKeys);
      routerRegistry.mergeEmptyPathStates(translated.emptyPathStates);
      routerRegistry.mergeLazyChildrenStates(translated.lazyChildrenStates);
      routerRegistry.mergeRouteProviders(translated.routeProviders);
      routerRegistry.mergePathToName(translated.pathToName);
    }

    const mod = angular.module(nextModuleName("ngjs.router.child"), ["ui.router"]);
    routerRegistry.registerModuleName(mod.name);
    routerRegistry.registerChildRoutes(mod.name, routes);

    const config = ($stateProvider: StateProvider) => {
      applyGlobalRedirects(translated);
      for (const state of states) $stateProvider.state({ ...state }); // clon: UI-Router muta la decl (quita lazyLoad); no compartir entre bootstraps
    };
    config.$inject = ["$stateProvider"];

    mod.config(config);
    if (translated.routeProviders.size) {
      const registerProviders = ($provide: angular.auto.IProvideService) => {
        for (const providers of translated.routeProviders.values()) RuntimeProviders.register($provide, providers);
      };
      registerProviders.$inject = ["$provide"];
      mod.config(registerProviders);
    }
    if (guards.length) mod.run(wireGuards(guards));
    if (deactivateGuards.length) mod.run(wireDeactivateGuards(deactivateGuards));
    if (matchGuards.length) mod.run(wireMatchGuards(matchGuards));
    if (translated.lazyRoutes.length) mod.run(wireLazyRoutes(translated.lazyRoutes));

    return mod;
  },
};
