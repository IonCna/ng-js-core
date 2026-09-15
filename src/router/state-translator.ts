import { type Ng1StateDeclaration, ParamType } from "@uirouter/angularjs";
import type angular from "angular";
import { runInInjectionContext } from "@/core/di/injection-context.ts";
import type { Provider } from "@/core/di/provider.ts";
import { bindingsFromDefs } from "@/core/metadata/component-bindings.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getNgModuleDef } from "@/core/metadata/ng-module.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import type {
  ActivatedRouteSnapshot,
  CanActivateFn,
  CanDeactivateFn,
  CanMatchFn,
  Data,
  LoadChildrenResult,
  ResolveData,
  ResolveFn,
  Route,
  RouterStateSnapshot,
  Routes,
} from "@/router/route.ts";
import { resolveRouteComponentInstance } from "@/router/route-component-registry.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import { LazyNgModuleLoader } from "@/runtime/lazy-ng-module-loader.ts";
import { ngModuleScopes } from "@/runtime/ng-module-instances.ts";

export interface GuardBinding {
  stateName: string;
  canActivate: CanActivateFn[];
  data: Data;
  /** `true` → aplica a los descendientes de `stateName` (`canActivateChild`), no al estado en sí. */
  forChildren?: boolean;
}

export interface DeactivateBinding {
  stateName: string;
  /** camelCase del route component — para resolver su instancia en el `onExit`. */
  componentName?: string;
  /** `data` estática del state que sale — puebla `currentRoute.data`. */
  data: Data;
  guards: CanDeactivateFn<unknown>[];
}

export interface MatchBinding {
  stateName: string;
  /** Criterio `to` del hook: el state name, o `${name}.**` si es una ruta `loadChildren`. */
  criteria: string;
  route: Route;
  guards: CanMatchFn[];
}

export interface TranslatedRoutes {
  states: Ng1StateDeclaration[];
  guards: GuardBinding[];
  /** `canDeactivate` por state — se corre en `onExit` (Angular: recibe la instancia del componente). */
  deactivateGuards: DeactivateBinding[];
  /** `canMatch` por state — se corre en `onBefore` (no hay fallthrough en UI-Router: aborta o redirige al `**`). */
  matchGuards: MatchBinding[];
  /** `title` por state name — el `.run` de `RouterModule` setea `document.title`. */
  titles: Map<string, string | ResolveFn<string>>;
  /** Keys de `resolve` por state name — `ActivatedRoute.data` las mergea desde `transition.injector()`. */
  resolveKeys: Map<string, string[]>;
  /** State names con `path` vacío (`""`) — `ActivatedRoute.data` los usa para `paramsInheritanceStrategy: 'emptyOnly'`. */
  emptyPathStates: Set<string>;
  /** State names de rutas `loadChildren` — sus guards/resolvers corren en el injector del padre (ver `runInRouteContext`). */
  lazyChildrenStates: Set<string>;
  /** `Route.providers` por state name — el entorno de la ruta lo crea `NgModuleScopes.environmentForState`. */
  routeProviders: Map<string, Provider[]>;
  /** State name para `$urlRouterProvider.otherwise` (la ruta `**`), si hay. */
  wildcardState?: string;
  /** Full path desde root → state name (para resolver `redirectTo`). */
  pathToName: Map<string, string>;
  /**
   * Rutas con `redirectTo`, con el `redirectTo` **crudo** (path) + el `parentPath`
   * para re-resolverlo. `translate()` ya hizo la resolución local (misma tree);
   * esta lista deja re-resolver contra el `pathToName` global de `routerRegistry`
   * (redirects que cruzan `forRoot`↔`forChild`).
   */
  redirects: { state: Ng1StateDeclaration; redirectTo: string; parentPath: string }[];
  /** Componentes de ruta (`{ camelCase, clase, state }`) — `loadChildren` los registra en el chunk lazy; `canDeactivate` los trackea. */
  components: { name: string; cls: Function; stateName: string }[];
  /** Rutas `loadComponent`/`loadChildren` — las recorre el preloader (`withPreloading`). */
  lazyRoutes: LazyRouteEntry[];
}

/** Lo que necesita un handler lazy — sale de la `transition` al navegar, o del `$injector` al precargar. */
export interface LazyLoadContext {
  stateRegistry: StateRegistryLike;
  $injector: { has(name: string): boolean; get(name: string): unknown };
}

/** Una ruta lazy registrada. `load` es idempotente por app (memo compartido navegación ↔ preload). */
export interface LazyRouteEntry {
  readonly route: Route;
  readonly stateName: string;
  load(context: LazyLoadContext): Promise<void>;
  isLoaded($injector: object): boolean;
}

/**
 * Cargas lazy en curso/terminadas por app y state name. Sin esto, un preload y
 * una navegación al mismo chunk registrarían dos veces sus estados ("State
 * already defined"). Una carga que falla se olvida, así se puede reintentar.
 */
class LazyLoadMemo {
  private readonly byInjector = new WeakMap<object, Map<string, { promise: Promise<void>; done: boolean }>>();

  run($injector: object, stateName: string, load: () => Promise<void>): Promise<void> {
    let loads = this.byInjector.get($injector);
    if (!loads) {
      loads = new Map();
      this.byInjector.set($injector, loads);
    }
    const existing = loads.get(stateName);
    if (existing) return existing.promise;

    const entry = { promise: load(), done: false };
    loads.set(stateName, entry);
    const owner = loads;
    entry.promise.then(
      () => {
        entry.done = true;
      },
      () => {
        owner.delete(stateName);
      },
    );
    return entry.promise;
  }

  isLoaded($injector: object, stateName: string): boolean {
    return this.byInjector.get($injector)?.get(stateName)?.done ?? false;
  }
}

const lazyLoadMemo = new LazyLoadMemo();

/**
 * Rutas lazy **por app** (`$injector`) — las recorre el preloader. Por app y no en
 * `routerRegistry` (global al proceso): con varias apps (tests) cada una tiene que
 * precargar solo sus rutas. Lo llenan el `.run` de `forRoot`/`forChild` y cada
 * subárbol lazy al cargarse.
 */
class AppLazyRoutes {
  private readonly byInjector = new WeakMap<object, LazyRouteEntry[]>();

  add($injector: object, entries: LazyRouteEntry[]): void {
    let list = this.byInjector.get($injector);
    if (!list) {
      list = [];
      this.byInjector.set($injector, list);
    }
    for (const entry of entries) if (!list.includes(entry)) list.push(entry);
  }

  of($injector: object): readonly LazyRouteEntry[] {
    return this.byInjector.get($injector) ?? [];
  }
}

export const appLazyRoutes = new AppLazyRoutes();

/** `.run` que suma las rutas lazy de un árbol (`forRoot`/`forChild`) a las de la app. */
export function wireLazyRoutes(entries: LazyRouteEntry[]) {
  const run = ($injector: object) => appLazyRoutes.add($injector, entries);
  run.$inject = ["$injector"];
  return run;
}

class LazyRoute implements LazyRouteEntry {
  constructor(
    readonly route: Route,
    readonly stateName: string,
    private readonly handler: (context: LazyLoadContext) => Promise<void>,
  ) {}

  load(context: LazyLoadContext): Promise<void> {
    return lazyLoadMemo.run(context.$injector, this.stateName, () => this.handler(context));
  }

  isLoaded($injector: object): boolean {
    return lazyLoadMemo.isLoaded($injector, this.stateName);
  }

  /** Handler `lazyLoad` de UI-Router: arma el contexto desde la transición. */
  forTransition(): (transition: LazyTransition) => Promise<void> {
    return (transition) =>
      this.load({
        stateRegistry: transition.router.stateRegistry,
        $injector: transition.injector().get("$injector") as LazyLoadContext["$injector"],
      });
  }
}

const WILDCARD = "**";

function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

function segmentName(path: string | undefined, index: number): string {
  const raw = (path ?? "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return raw || `route${index}`;
}

/** Desambigua nombres locales repetidos entre hermanos (`"a/b"` y `"a.b"` → `"a_b"` y `"a_b_2"`). */
function dedupe(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 2;
  while (used.has(`${name}_${n}`)) n += 1;
  const unique = `${name}_${n}`;
  used.add(unique);
  return unique;
}

/** URL relativa a la del padre (UI-Router la concatena). Vacío → estado sin URL propia. */
function segmentUrl(path: string | undefined): string {
  const p = path ?? "";
  return p ? `/${p}` : "";
}

function joinPath(parent: string, segment: string): string {
  const s = `${parent}/${segment}`.replace(/\/{2,}/g, "/").replace(/^\/|\/$/g, "");
  return s;
}

function componentName(route: Route): string | undefined {
  if (!route.component) return undefined;
  const def = getComponentDef(route.component);
  if (!def) {
    throw new Error(`RouterModule: el component de la ruta "${route.path ?? ""}" no tiene @Component (ɵcmp).`);
  }
  return toCamelCase(def.selector);
}

/**
 * Corre `fn` (guard, resolver, `title`) en el injection context de la ruta `stateName`:
 * si la ruta cae dentro de una rama lazy (`loadChildren` → `@NgModule`), `inject()`
 * resuelve contra el entorno de esa rama; si no, contra la app. Como
 * `getClosestRouteInjector` de Angular, una ruta `loadChildren` **no** usa el
 * injector que ella misma carga, sino el de su padre.
 */
export function runInRouteContext<T>($injector: unknown, stateName: string, fn: () => T): T {
  if (!$injector) return fn();
  const environment = ngModuleScopes.environmentForState(
    $injector as angular.auto.IInjectorService,
    stateName,
    routerRegistry.lazyChildrenStates.has(stateName),
  );
  if (!environment) return fn();
  return runInInjectionContext({ get: (token, options) => environment.get(token, options) }, fn);
}

/** `resolve: { key: fn }` → forma de UI-Router `{ key: ["$stateParams", "$location", "$injector", (…) => fn(snapshot)] }`. */
function translateResolve(
  resolve: ResolveData | undefined,
  data: Data,
  stateName: string,
): Record<string, unknown> | undefined {
  if (!resolve) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resolve)) {
    if (typeof value !== "function") continue; // Type<T> tokens: fuera del MVP
    out[key] = [
      "$stateParams",
      "$location",
      "$injector",
      (
        $stateParams: Record<string, string>,
        $location: { search(): Record<string, string>; hash(): string },
        $injector: unknown,
      ) => {
        const snapshot: ActivatedRouteSnapshot = {
          params: { ...$stateParams },
          data,
          queryParams: { ...$location.search() },
          fragment: $location.hash() || null,
        };
        return runInRouteContext($injector, stateName, () =>
          (value as (r: ActivatedRouteSnapshot) => unknown)(snapshot),
        );
      },
    ];
  }
  return Object.keys(out).length ? out : undefined;
}

function resolveKeysOf(resolve: ResolveData | undefined): string[] {
  if (!resolve) return [];
  return Object.entries(resolve)
    .filter(([, v]) => typeof v === "function")
    .map(([k]) => k);
}

function lazyLoadFor(route: Route, stateName: string, url: string, data: Data) {
  const load = route.loadComponent;
  if (!load) throw new Error("lazyLoadFor: ruta sin loadComponent");

  return async (context: LazyLoadContext) => {
    const loaded = await load();
    const cls = ((loaded as { default?: unknown }).default ?? loaded) as new (...args: never[]) => unknown;
    const def = getComponentDef(cls);
    if (!def) throw new Error(`RouterModule: loadComponent de "${route.path ?? ""}" no resolvió una clase @Component.`);

    const registrar = ConfigProviderFactory.current;
    if (!registrar)
      throw new Error("RouterModule: no hay config-providers capturados (¿falta installCoreModule/bootstrap?).");

    const name = toCamelCase(def.selector);
    registrar.$compile.component(name, {
      controller: cls as never,
      template: def.template,
      templateUrl: def.templateUrl,
      controllerAs: def.controllerAs ?? routerRegistry.controllerAs,
      bindings: def.bindings ?? bindingsFromDefs(def.inputs, def.outputs),
    });

    // UI-Router quita `lazyLoad` del estado y reintenta la transición. Reemplazamos
    // el estado (mismo nombre, misma URL) por uno ya con `component` — sin
    // `lazyLoad` — vía el registry en vivo, en vez de devolver `{ states }`
    // (que choca con "State already defined").
    const registry = context.stateRegistry;
    registry.deregister(stateName);
    registry.register({
      name: stateName,
      url,
      component: name,
      data,
      resolve: translateResolve(route.resolve, data, stateName) as never,
    });
  };
}

export interface StateRegistryLike {
  deregister(name: string): unknown;
  register(state: Ng1StateDeclaration): unknown;
}

interface GuardTransition {
  to(): { name: string };
  params(): Record<string, string>;
  injector(): { get(token: string): unknown };
}

interface DeactivateTransition {
  params(which: "to" | "from"): Record<string, string>;
  to(): { name: string; data?: Data };
  from(): { name: string; data?: Data };
  router: { stateService: { href(name: string, params?: Record<string, string>): string | null } };
  injector(): { get(token: string): unknown };
}

// Compatible estructuralmente con `TransitionService` de UI-Router (solo lo que se usa).
// biome-ignore lint/suspicious/noExplicitAny: la firma real de estos hooks es más amplia
type TransitionsLike = {
  onBefore(criteria: any, callback: (transition: any) => any): unknown;
  onExit(criteria: any, callback: (transition: any) => any): unknown;
};

/**
 * Corre una lista de guards y devuelve un `boolean` **síncrono** cuando ninguno
 * es async. Esto es clave para los hooks `onBefore`: si el callback devuelve una
 * Promise, UI-Router descarta un `redirectTo` de otra ruta que apunte a este
 * estado (la transición redirigida se pierde en la primera navegación). Solo se
 * devuelve una Promise si algún guard realmente lo es.
 */
function runGuards<T>(guards: ((arg: T) => boolean | Promise<boolean>)[], arg: T): boolean | Promise<boolean> {
  const pending: Promise<boolean>[] = [];
  for (const guard of guards) {
    const result = guard(arg);
    if (result === false) return false;
    if (result !== true) pending.push(Promise.resolve(result));
  }
  if (pending.length === 0) return true;
  return (async () => {
    for (const p of pending) {
      if ((await p) === false) return false;
    }
    return true;
  })();
}

/**
 * Registra un guard (`canActivate` / `canActivateChild`) como hook `onBefore`.
 * Reusado por `RouterModule` (guards eager) y por el handler de `loadChildren`
 * (guards del subárbol lazy — se wirean con el `$transitions` de la transición).
 */
export function wireGuardHook($transitions: TransitionsLike, guard: GuardBinding): void {
  const criteria = guard.forChildren ? { to: `${guard.stateName}.**` } : { to: guard.stateName };
  $transitions.onBefore(criteria, (transition: GuardTransition) => {
    if (guard.forChildren && transition.to().name === guard.stateName) return true;
    const snapshot = {
      params: transition.params(),
      data: guard.data,
    } as ActivatedRouteSnapshot;
    const $injector = transition.injector().get("$injector");
    return runInRouteContext($injector, guard.stateName, () => runGuards(guard.canActivate, snapshot));
  });
}

/** `{ url, root }` plano desde el `transition` (Angular: `RouterStateSnapshot`). */
function buildStateSnapshot(transition: DeactivateTransition, which: "to" | "from"): RouterStateSnapshot {
  const decl = which === "to" ? transition.to() : transition.from();
  const params = transition.params(which);
  const url = (transition.router.stateService.href(decl.name, params) ?? "").replace(/^#/, "");
  return { url, root: { params, data: (decl.data ?? {}) as Data } };
}

/**
 * `canDeactivate` → hook `onExit` sobre el estado: dispara exactamente cuando el
 * componente va a destruirse (salga por navegación directa o al dejar la rama).
 * Firma de Angular: `(component, currentRoute, currentState, nextState)`.
 * `component` sale de `RouteComponentRegistry` (`null` si no resuelve);
 * `currentRoute` es `{ params(from), data }`; `currentState`/`nextState` son
 * `{ url, root }` planos (sin árbol `.children` — brecha). `false` aborta.
 */
export function wireDeactivateHook($transitions: TransitionsLike, binding: DeactivateBinding): void {
  $transitions.onExit({ exiting: binding.stateName }, async (transition: DeactivateTransition) => {
    const instance = binding.componentName ? (resolveRouteComponentInstance(binding.componentName) ?? null) : null;
    const currentRoute: ActivatedRouteSnapshot = { params: transition.params("from"), data: binding.data };
    const currentState = buildStateSnapshot(transition, "from");
    const nextState = buildStateSnapshot(transition, "to");
    const $injector = transition.injector().get("$injector");
    for (const canDeactivate of binding.guards) {
      const result = runInRouteContext($injector, binding.stateName, () =>
        canDeactivate(instance, currentRoute, currentState, nextState),
      );
      if ((await result) === false) return false;
    }
    return true;
  });
}

/**
 * `canMatch` → hook `onBefore` (corre antes de resolver `lazyLoad`, así una ruta
 * `loadChildren` no baja el chunk si no matchea). UI-Router no tiene fallthrough:
 * si algún guard da `false`, se **aborta** la transición (la app se queda donde
 * estaba). "Probá la siguiente ruta / caé al `**`" no se replica — brecha.
 *
 * `runGuards` mantiene el hook **síncrono** cuando los `canMatch` no son async —
 * un `onBefore` que devuelve Promise rompe un `redirectTo` de otra ruta hacia
 * este estado.
 */
export function wireMatchHook($transitions: TransitionsLike, binding: MatchBinding): void {
  $transitions.onBefore({ to: binding.criteria }, (transition: GuardTransition) =>
    runInRouteContext(transition.injector().get("$injector"), binding.stateName, () =>
      runGuards(binding.guards, binding.route),
    ),
  );
}

/**
 * Resultado de `loadChildren` → `Routes`. Una clase `@NgModule` (o `{ default }` con
 * una) se carga en la app viva con `LazyNgModuleLoader`, que registra sus
 * declarations/providers/imports y devuelve las `Routes` de sus `forChild`.
 */
function unwrapLazyRoutes(loaded: LoadChildrenResult, $injector: unknown, stateName: string): Routes {
  if (Array.isArray(loaded)) return loaded;
  if (typeof loaded === "function" && getNgModuleDef(loaded)) {
    const loader = new LazyNgModuleLoader($injector as ConstructorParameters<typeof LazyNgModuleLoader>[0]);
    return loader.load(loaded, stateName);
  }
  if ("routes" in loaded && Array.isArray(loaded.routes)) return loaded.routes;
  if ("default" in loaded && loaded.default) return unwrapLazyRoutes(loaded.default, $injector, stateName);
  throw new Error("RouterModule: loadChildren no resolvió Routes / { routes } / { default } / clase @NgModule.");
}

interface LazyTransition {
  router: { stateRegistry: StateRegistryLike };
  injector(): { get(token: string): unknown };
}

/**
 * Handler `lazyLoad` del *future state* `${stateName}.**`. Al navegar a una URL
 * bajo `stateName`: baja el chunk (`import()`), traduce su subárbol rooteado en
 * `stateName`, registra sus estados + componentes (idempotente) + guards +
 * titles/resolveKeys, y reemplaza el future state por el `stateName` real.
 * UI-Router reintenta la transición y ahí ya resuelve.
 */
function lazyLoadChildrenFor(
  route: Route,
  stateName: string,
  url: string,
  fullPath: string,
  data: Data,
  inRootChain: boolean,
) {
  const load = route.loadChildren;
  if (!load) throw new Error("lazyLoadChildrenFor: ruta sin loadChildren");

  return async (context: LazyLoadContext) => {
    const { $injector } = context;
    const childRoutes = unwrapLazyRoutes(await load(), $injector, stateName);
    const sub = translate(childRoutes, stateName, fullPath, inRootChain);

    // El subárbol lazy entra al registro global: sus `titles`/`resolveKeys` los
    // leen `wireTitles` / `ActivatedRoute` en vivo, y su `pathToName` deja
    // resolver un `redirectTo` cruzado hacia/desde el resto del árbol.
    routerRegistry.mergeTitles(sub.titles);
    routerRegistry.mergeResolveKeys(sub.resolveKeys);
    routerRegistry.mergeEmptyPathStates(sub.emptyPathStates);
    routerRegistry.mergeLazyChildrenStates(sub.lazyChildrenStates);
    routerRegistry.mergeRouteProviders(sub.routeProviders);
    routerRegistry.mergePathToName(sub.pathToName);
    appLazyRoutes.add($injector, sub.lazyRoutes);
    for (const { state, redirectTo, parentPath } of sub.redirects) {
      state.redirectTo = redirectTargetFor(redirectTo, parentPath, routerRegistry.pathToName) as never;
    }

    const registrar = ConfigProviderFactory.current;
    if (!registrar) throw new Error("RouterModule: no hay config-providers capturados.");
    const registry = context.stateRegistry;

    // Componentes del chunk lazy — idempotente (en compat se auto-registran al `import()`).
    for (const { name, cls } of sub.components) {
      if ($injector.has(`${name}Directive`)) continue;
      const def = getComponentDef(cls);
      if (!def) continue;
      registrar.$compile.component(name, {
        controller: cls as never,
        template: def.template,
        templateUrl: def.templateUrl,
        controllerAs: def.controllerAs ?? routerRegistry.controllerAs,
        bindings: def.bindings ?? bindingsFromDefs(def.inputs, def.outputs),
      });
    }

    for (const state of sub.states) registry.register(state);

    const $transitions = $injector.get("$transitions") as TransitionsLike;
    for (const guard of sub.guards) wireGuardHook($transitions, guard);
    for (const binding of sub.deactivateGuards) wireDeactivateHook($transitions, binding);
    for (const binding of sub.matchGuards) wireMatchHook($transitions, binding);

    // Reemplazar el future state por el `stateName` real (pass-through, sin componente
    // propio — los hijos renderizan en el `<ui-view>` ancestro, como en Angular).
    // Con hijo índice (`path: ""`, el idiom de un `@NgModule` lazy) padre e hijo
    // computan la misma URL y UI-Router puede quedarse con el padre, que no tiene
    // componente. El padre redirige al hijo índice: cubre el match por URL y la
    // navegación por nombre (`ui-sref="admin"`), que con `abstract` se rechazaría.
    const hasIndexChild = childRoutes.some((child) => (child.path ?? "") === "");
    const indexState = hasIndexChild ? sub.pathToName.get(fullPath.replace(/^\/|\/$/g, "")) : undefined;
    registry.deregister(`${stateName}.**`);
    registry.register({ name: stateName, url, data, redirectTo: indexState });
  };
}

/**
 * `redirectTo` (path, relativo al padre o absoluto `/x`) → state name destino.
 * Sin soporte para `../` (fuera del MVP). Si no matchea, se deja el string crudo
 * (UI-Router lo interpretará como pueda).
 */
export function resolveRedirect(redirectTo: string, parentPath: string, pathToName: Map<string, string>): string {
  return pathToName.get(redirectPath(redirectTo, parentPath)) ?? redirectTo;
}

/** `redirectTo` (relativo al padre o absoluto `/x`) → path absoluto sin barras de borde. */
function redirectPath(redirectTo: string, parentPath: string): string {
  const target = redirectTo.startsWith("/") ? redirectTo.slice(1) : joinPath(parentPath, redirectTo);
  return target.replace(/^\/|\/$/g, "");
}

/**
 * Como `resolveRedirect`, pero si el path no resuelve contra la config conocida (cae
 * dentro de un módulo lazy sin cargar) devuelve un `redirectTo` **async** que lo
 * resuelve al navegar — ver `LazyRedirect`. Lo usan las pasadas globales (config de
 * `forRoot`/`forChild` y cada subárbol lazy), cuando ya no va a aparecer otro árbol eager.
 */
export function redirectTargetFor(
  redirectTo: string,
  parentPath: string,
  pathToName: Map<string, string>,
): string | ((transition: LazyRedirectTransition) => Promise<unknown>) {
  const resolved = pathToName.get(redirectPath(redirectTo, parentPath));
  if (resolved) return resolved;
  const redirect = new LazyRedirect(redirectPath(redirectTo, parentPath), redirectTo);
  return (transition) => redirect.resolve(transition);
}

interface UrlMatch {
  rule?: { type?: string; state?: { name: string } };
  match?: Record<string, unknown>;
}

export interface LazyRedirectTransition extends LazyTransition {
  router: {
    stateRegistry: StateRegistryLike;
    stateService: { target(name: string, params?: Record<string, unknown>): unknown };
    urlService: { match(parts: { path: string }): UrlMatch | undefined };
  };
}

/** Máximo de ramas lazy anidadas que se cargan para resolver un destino (evita loops). */
const MAX_LAZY_DEPTH = 10;

/**
 * Carga, en cadena, las ramas lazy necesarias para que una URL resuelva a un estado
 * real: mientras la URL matchee un *future state* (`nombre.**`), baja ese chunk (con el
 * memo compartido con navegación/preload) y vuelve a matchear. Devuelve el match final
 * (estado real + params) o `undefined`. Lo usan `LazyRedirect` y los links `ui-sref`.
 */
export async function loadLazyChainForUrl(
  path: string,
  urlService: { match(parts: { path: string }): UrlMatch | undefined },
  context: LazyLoadContext,
): Promise<UrlMatch | undefined> {
  for (let depth = 0; depth < MAX_LAZY_DEPTH; depth++) {
    const matched = urlService.match({ path });
    const stateName = matched?.rule?.type === "STATE" ? matched.rule.state?.name : undefined;
    if (!stateName) return undefined;
    if (!stateName.endsWith(".**")) return matched;

    const entry = lazyEntryForFutureState(context.$injector, stateName);
    if (!entry) return undefined;
    await entry.load(context);
  }
  return undefined;
}

/** Ruta lazy (`loadChildren`) de esta app cuyo future state es `futureName` (`admin.**` → `admin`). */
export function lazyEntryForFutureState($injector: object, futureName: string): LazyRouteEntry | undefined {
  const stateName = futureName.slice(0, -".**".length);
  return appLazyRoutes.of($injector).find((entry) => entry.stateName === stateName && entry.route.loadChildren);
}

/**
 * Ruta lazy (`loadChildren`) **sin cargar** que contiene al estado `stateName` (el
 * propio future state o un descendiente: `admin.users_id` → `admin`). La más profunda
 * gana. Para links por nombre a un estado que todavía no existe.
 */
export function unloadedLazyEntryForState($injector: object, stateName: string): LazyRouteEntry | undefined {
  let best: LazyRouteEntry | undefined;
  for (const entry of appLazyRoutes.of($injector)) {
    if (!entry.route.loadChildren || entry.isLoaded($injector)) continue;
    const contains = stateName === entry.stateName || stateName.startsWith(`${entry.stateName}.`);
    if (contains && (!best || entry.stateName.length > best.stateName.length)) best = entry;
  }
  return best;
}

/**
 * `redirectTo` hacia un path dentro de un módulo lazy sin cargar: al navegar, baja las
 * ramas lazy necesarias y redirige al estado real con sus params (UI-Router acepta un
 * `redirectTo` async). Si aún así no resuelve, deja el `redirectTo` crudo (mismo
 * comportamiento que antes).
 */
class LazyRedirect {
  constructor(
    private readonly path: string,
    private readonly raw: string,
  ) {}

  async resolve(transition: LazyRedirectTransition): Promise<unknown> {
    const router = transition.router;
    const context: LazyLoadContext = {
      stateRegistry: router.stateRegistry,
      $injector: transition.injector().get("$injector") as LazyLoadContext["$injector"],
    };
    const matched = await loadLazyChainForUrl(`/${this.path}`, router.urlService, context);
    const stateName = matched?.rule?.state?.name;
    if (stateName) return router.stateService.target(stateName, matched?.match ?? {});
    return routerRegistry.pathToName.get(this.path) ?? this.raw;
  }
}

const SEGMENT_END_PARAM = "ngjsSegmentEnd";

/**
 * Tipo del param de límite de segmento, como **instancia** en `params` del future
 * state (no registrado por nombre: en AngularJS los tipos de `.config` se encolan
 * hasta el `$get`, y los estados de `forRoot` se compilan antes). Mantiene el
 * lookahead al matchear URL — `/admin` no captura `/admin-default` — y valida
 * vacío/ausente, así navegar por nombre (`$state.go("admin.x")`, `ui-sref`) no lo
 * rechaza. Una regex inline no valida `undefined`, y un default la volvería opcional.
 */
const SEGMENT_END_TYPE = new ParamType({
  name: SEGMENT_END_PARAM,
  pattern: /(?=\/|$)/,
  is: (value: unknown) => value === undefined || value === null || value === "",
  encode: (value: unknown) => (value == null ? "" : String(value)),
  decode: (value: unknown) => (value == null ? "" : String(value)),
  equals: (a: unknown, b: unknown) => (a ?? "") === (b ?? ""),
} as never);

/**
 * URL del *future state* `nombre.**`. UI-Router le agrega `{remainder:any}` y la
 * matchea como prefijo de **texto**: `/admin` agarraría también `/admin-default`
 * (baja el chunk equivocado y cae en `otherwise`). Un param de ancho cero con
 * lookahead exige que el prefijo termine en un límite de segmento (`/` o fin).
 * Sin segmento propio (`""`/`"/"`) no hace falta — y romperia el match.
 */
function futureStateUrl(url: string): string {
  if (!url || url.endsWith("/")) return url;
  return `${url}{${SEGMENT_END_PARAM}}`;
}

interface WalkCtx {
  out: TranslatedRoutes;
  parentName?: string;
  parentPath: string;
  /**
   * `true` mientras todos los ancestros (desde la raíz de `forRoot`) tienen `path: ""`.
   * En esa cadena las rutas llevan `url: ""` y solo la hoja (sin hijos) lleva `"/"`:
   * con `"/"` en un layout, UI-Router concatena sus hijos como `//hijo`. En `forChild`
   * arranca en `false` (`url: ""`, relativa al padre).
   */
  rootEmptyChain: boolean;
  /** Rutas con `redirectTo` para resolver en 2ª pasada, cuando `pathToName` está completo. */
  redirects: { state: Ng1StateDeclaration; redirectTo: string; parentPath: string }[];
}

/**
 * Detecta el hijo "índice" (`{ path: "", pathMatch: "full", redirectTo }`, el
 * idiom de Angular real para "layout con componente + redirect por default a
 * un hijo") cuando es el ÚNICO responsable de ese `redirectTo` — sin `title`,
 * sin `children`, sin guards ni `loadComponent`/`loadChildren` propios.
 *
 * Existe porque UI-Router, a diferencia de Angular real, no resuelve un match
 * de URL contra el hijo más específico cuando padre e hijo-índice computan la
 * MISMA url (padre con `url` propia + hijo con `url: ""`): dos states con
 * texto de url idéntico son ambiguos para UI-Router, y en la práctica gana el
 * registrado primero (el padre) — el hijo-índice nunca llega a activarse por
 * navegación directa a esa URL. Ver CONCEPTOS/gap del router.
 */
function findFoldableIndexRedirect(route: Route): Route | undefined {
  if (!route.children?.length) return undefined;
  const candidates = route.children.filter(
    (child) =>
      (child.path ?? "") === "" &&
      child.redirectTo !== undefined &&
      !child.children?.length &&
      !child.loadComponent &&
      !child.loadChildren &&
      !child.title &&
      !child.canActivate?.length &&
      !child.canActivateChild?.length &&
      !child.canDeactivate?.length &&
      !child.canMatch?.length,
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

function walk(routes: Routes, ctx: WalkCtx): void {
  const usedLocals = new Set<string>();
  routes.forEach((route, index) => {
    const isWildcard = route.path === WILDCARD;
    const local = dedupe(isWildcard ? "__wildcard__" : segmentName(route.path, index), usedLocals);
    const name = ctx.parentName ? `${ctx.parentName}.${local}` : local;
    const fullPath = isWildcard ? `${ctx.parentPath}/**` : joinPath(ctx.parentPath, route.path ?? "");
    // `**` → param greedy `.+` (≥1 char, así no pisa la ruta `/` del root).
    // Cadena de `path: ""` desde la raíz de `forRoot` (layout/shell raíz, módulo lazy en
    // la raíz): `url: ""`, salvo la hoja → `"/"` para matchear la raíz. Así un layout
    // `{ path: "", component: Shell, children }` deja a sus hijos en `/hijo` (no `//hijo`).
    // Se calcula acá (no en `RouterModule`) para que también lo capture `lazyLoadFor`.
    const inRootChain = ctx.rootEmptyChain && !isWildcard && (route.path ?? "") === "";
    const hasChildren = Boolean(route.children?.length || route.loadChildren);
    const isRootIndex = inRootChain && !hasChildren;
    const url = isWildcard ? "/{ngjsCatchAll:.+}" : isRootIndex ? "/" : inRootChain ? "" : segmentUrl(route.path);
    const data = route.data ?? {};

    ctx.out.pathToName.set(fullPath.replace(/^\/|\/$/g, ""), name);

    const state: Ng1StateDeclaration = { name, url, data };

    // Hijo-índice (`{ path: "", redirectTo }`) que computaría la MISMA url que
    // este state — se pliega acá (ver `findFoldableIndexRedirect`) en vez de
    // registrarse como sibling separado, porque UI-Router no lo activaría nunca
    // por navegación directa a esa URL (ambigüedad de url idéntica padre/hijo).
    // En la cadena raíz no hace falta plegar: el padre lleva `""` y el hijo índice `"/"`.
    const foldableRedirect =
      route.redirectTo === undefined && !route.loadComponent && !route.loadChildren && !inRootChain
        ? findFoldableIndexRedirect(route)
        : undefined;

    if (route.redirectTo !== undefined) {
      state.redirectTo = route.redirectTo; // se re-resuelve en la 2ª pasada
      ctx.redirects.push({ state, redirectTo: route.redirectTo, parentPath: ctx.parentPath });
    } else if (route.loadComponent) {
      const lazy = new LazyRoute(route, name, lazyLoadFor(route, name, url, data));
      state.lazyLoad = lazy.forTransition() as never;
      ctx.out.lazyRoutes.push(lazy);
    } else if (route.loadChildren) {
      ctx.out.lazyChildrenStates.add(name);
      // Future state: el sufijo `.**` hace que la URL de este segmento matchee
      // como prefijo y dispare `lazyLoad` aunque los hijos no existan todavía.
      state.name = `${name}.**`;
      // UI-Router solo agrega `{remainder:any}` a future states con url no vacía: un módulo
      // lazy en la cadena raíz (`url: ""`) usa `"/"` como prefijo (matchea `/` y todo lo de abajo).
      state.url = url === "" && inRootChain ? "/" : futureStateUrl(url);
      if (state.url !== url) state.params = { [SEGMENT_END_PARAM]: { type: SEGMENT_END_TYPE } } as never;
      const lazy = new LazyRoute(route, name, lazyLoadChildrenFor(route, name, url, fullPath, data, inRootChain));
      state.lazyLoad = lazy.forTransition() as never;
      ctx.out.lazyRoutes.push(lazy);
    } else {
      const comp = componentName(route);
      if (comp) {
        state.component = comp;
        ctx.out.components.push({ name: comp, cls: route.component as Function, stateName: name });
      }
      const resolve = translateResolve(route.resolve, data, name);
      if (resolve) state.resolve = resolve as never;

      if (foldableRedirect) {
        // Relativo a `fullPath` de ESTE state — es el mismo `parentPath` que
        // hubiera usado el hijo si se procesara normalmente (`walk` recursivo
        // pasa `parentPath: fullPath` a sus hijos).
        state.redirectTo = foldableRedirect.redirectTo;
        ctx.redirects.push({ state, redirectTo: foldableRedirect.redirectTo as string, parentPath: fullPath });
      }
    }

    if (route.title !== undefined) ctx.out.titles.set(name, route.title);
    if (route.providers?.length) ctx.out.routeProviders.set(name, route.providers);
    const rk = resolveKeysOf(route.resolve);
    if (rk.length) ctx.out.resolveKeys.set(name, rk);
    if ((route.path ?? "") === "" && route.redirectTo === undefined) ctx.out.emptyPathStates.add(name);
    if (isWildcard) ctx.out.wildcardState = name; // último gana

    ctx.out.states.push(state);

    if (route.canActivate?.length) {
      // En una ruta `loadChildren`, `canActivate` guarda toda la rama (glob `.**`).
      ctx.out.guards.push({
        stateName: name,
        canActivate: route.canActivate,
        data,
        forChildren: route.loadChildren ? true : undefined,
      });
    }
    if (route.canActivateChild?.length) {
      ctx.out.guards.push({ stateName: name, canActivate: route.canActivateChild, data, forChildren: true });
    }
    if (route.canDeactivate?.length) {
      ctx.out.deactivateGuards.push({
        stateName: name,
        componentName: route.component ? componentName(route) : undefined,
        data,
        guards: route.canDeactivate,
      });
    }
    if (route.canMatch?.length) {
      ctx.out.matchGuards.push({
        stateName: name,
        criteria: route.loadChildren ? `${name}.**` : name,
        route,
        guards: route.canMatch,
      });
    }

    const remainingChildren = foldableRedirect ? route.children!.filter((c) => c !== foldableRedirect) : route.children;
    if (remainingChildren?.length) {
      walk(remainingChildren, {
        ...ctx,
        parentName: name,
        parentPath: fullPath,
        rootEmptyChain: inRootChain,
        redirects: ctx.redirects,
      });
    }
  });
}

/** Traduce un árbol de `Routes` a estados, rooteado en `parentName`/`parentPath`. */
function translate(
  routes: Routes,
  parentName: string | undefined,
  parentPath: string,
  rootEmptyChain = false,
): TranslatedRoutes {
  const out: TranslatedRoutes = {
    states: [],
    guards: [],
    deactivateGuards: [],
    matchGuards: [],
    titles: new Map(),
    resolveKeys: new Map(),
    emptyPathStates: new Set(),
    lazyChildrenStates: new Set(),
    routeProviders: new Map(),
    pathToName: new Map(),
    redirects: [],
    components: [],
    lazyRoutes: [],
  };
  walk(routes, { out, parentName, parentPath, rootEmptyChain, redirects: out.redirects });

  // Resolución local (misma tree). La global (contra `routerRegistry.pathToName`)
  // la aplica `RouterModule` en fase config, cuando ya están todos los árboles.
  for (const { state, redirectTo, parentPath: pp } of out.redirects) {
    state.redirectTo = resolveRedirect(redirectTo, pp, out.pathToName);
  }

  return out;
}

export function routesToStates(routes: Routes, isRoot = false): TranslatedRoutes {
  return translate(routes, undefined, "", isRoot);
}
