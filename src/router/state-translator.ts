import type { Ng1StateDeclaration } from "@uirouter/angularjs";
import { bindingsFromDefs } from "@/core/metadata/component-bindings.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import type {
  ActivatedRouteSnapshot,
  CanActivateFn,
  CanDeactivateFn,
  CanMatchFn,
  Data,
  ResolveData,
  ResolveFn,
  Route,
  Routes,
  RouterStateSnapshot,
} from "@/router/route.ts";
import { resolveRouteComponentInstance } from "@/router/route-component-registry.ts";

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
  /** State name para `$urlRouterProvider.otherwise` (la ruta `**`), si hay. */
  wildcardState?: string;
  /** Full path desde root → state name (para resolver `redirectTo`). */
  pathToName: Map<string, string>;
  /** Componentes de ruta (`{ camelCase, clase, state }`) — `loadChildren` los registra en el chunk lazy; `canDeactivate` los trackea. */
  components: { name: string; cls: Function; stateName: string }[];
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

/** `resolve: { key: fn }` → forma de UI-Router `{ key: ["$stateParams", "$location", ($sp, $loc) => fn(snapshot)] }`. */
function translateResolve(resolve: ResolveData | undefined, data: Data): Record<string, unknown> | undefined {
  if (!resolve) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resolve)) {
    if (typeof value !== "function") continue; // Type<T> tokens: fuera del MVP
    out[key] = [
      "$stateParams",
      "$location",
      ($stateParams: Record<string, string>, $location: { search(): Record<string, string>; hash(): string }) => {
        const snapshot: ActivatedRouteSnapshot = {
          params: { ...$stateParams },
          data,
          queryParams: { ...$location.search() },
          fragment: $location.hash() || null,
        };
        return (value as (r: ActivatedRouteSnapshot) => unknown)(snapshot);
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

  return async (transition: { router: { stateRegistry: StateRegistryLike } }) => {
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
      controllerAs: def.controllerAs,
      bindings: def.bindings ?? bindingsFromDefs(def.inputs, def.outputs),
    });

    // UI-Router quita `lazyLoad` del estado y reintenta la transición. Reemplazamos
    // el estado (mismo nombre, misma URL) por uno ya con `component` — sin
    // `lazyLoad` — vía el registry en vivo, en vez de devolver `{ states }`
    // (que choca con "State already defined").
    const registry = transition.router.stateRegistry;
    registry.deregister(stateName);
    registry.register({
      name: stateName,
      url,
      component: name,
      data,
      resolve: translateResolve(route.resolve, data) as never,
    });
  };
}

interface StateRegistryLike {
  deregister(name: string): unknown;
  register(state: Ng1StateDeclaration): unknown;
}

interface GuardTransition {
  to(): { name: string };
  params(): Record<string, string>;
}

interface DeactivateTransition {
  params(which: "to" | "from"): Record<string, string>;
  to(): { name: string; data?: Data };
  from(): { name: string; data?: Data };
  router: { stateService: { href(name: string, params?: Record<string, string>): string | null } };
}

// Compatible estructuralmente con `TransitionService` de UI-Router (solo lo que se usa).
// biome-ignore lint/suspicious/noExplicitAny: la firma real de estos hooks es más amplia
type TransitionsLike = {
  onBefore(criteria: any, callback: (transition: any) => any): unknown;
  onExit(criteria: any, callback: (transition: any) => any): unknown;
};

/**
 * Registra un guard (`canActivate` / `canActivateChild`) como hook `onBefore`.
 * Reusado por `RouterModule` (guards eager) y por el handler de `loadChildren`
 * (guards del subárbol lazy — se wirean con el `$transitions` de la transición).
 */
export function wireGuardHook($transitions: TransitionsLike, guard: GuardBinding): void {
  const criteria = guard.forChildren ? { to: `${guard.stateName}.**` } : { to: guard.stateName };
  $transitions.onBefore(criteria, async (transition: GuardTransition) => {
    if (guard.forChildren && transition.to().name === guard.stateName) return true;
    const snapshot = {
      params: transition.params(),
      data: guard.data,
    } as ActivatedRouteSnapshot;
    for (const canActivate of guard.canActivate) {
      if ((await canActivate(snapshot)) === false) return false;
    }
    return true;
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
    const instance = binding.componentName
      ? (resolveRouteComponentInstance(binding.componentName) ?? null)
      : null;
    const currentRoute: ActivatedRouteSnapshot = { params: transition.params("from"), data: binding.data };
    const currentState = buildStateSnapshot(transition, "from");
    const nextState = buildStateSnapshot(transition, "to");
    for (const canDeactivate of binding.guards) {
      if ((await canDeactivate(instance, currentRoute, currentState, nextState)) === false) return false;
    }
    return true;
  });
}

/**
 * `canMatch` → hook `onBefore` (corre antes de resolver `lazyLoad`, así una ruta
 * `loadChildren` no baja el chunk si no matchea). UI-Router no tiene fallthrough:
 * si algún guard da `false`, se **aborta** la transición (la app se queda donde
 * estaba). "Probá la siguiente ruta / caé al `**`" no se replica — brecha.
 */
export function wireMatchHook($transitions: TransitionsLike, binding: MatchBinding): void {
  $transitions.onBefore({ to: binding.criteria }, async () => {
    for (const canMatch of binding.guards) {
      if ((await canMatch(binding.route)) === false) return false;
    }
    return true;
  });
}

function unwrapLazyRoutes(loaded: Routes | { routes: Routes } | { default: Routes }): Routes {
  if (Array.isArray(loaded)) return loaded;
  if ("routes" in loaded && Array.isArray(loaded.routes)) return loaded.routes;
  if ("default" in loaded && Array.isArray(loaded.default)) return loaded.default;
  throw new Error("RouterModule: loadChildren no resolvió Routes / { routes } / { default }.");
}

interface LazyChildrenTransition {
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
  out: TranslatedRoutes,
) {
  const load = route.loadChildren;
  if (!load) throw new Error("lazyLoadChildrenFor: ruta sin loadChildren");

  return async (transition: LazyChildrenTransition) => {
    const childRoutes = unwrapLazyRoutes(await load());
    const sub = translate(childRoutes, stateName, fullPath);

    const registrar = ConfigProviderFactory.current;
    if (!registrar) throw new Error("RouterModule: no hay config-providers capturados.");
    const registry = transition.router.stateRegistry;
    const $injector = transition.injector().get("$injector") as { has(name: string): boolean };

    // Componentes del chunk lazy — idempotente (en compat se auto-registran al `import()`).
    for (const { name, cls } of sub.components) {
      if ($injector.has(`${name}Directive`)) continue;
      const def = getComponentDef(cls);
      if (!def) continue;
      registrar.$compile.component(name, {
        controller: cls as never,
        template: def.template,
        templateUrl: def.templateUrl,
        controllerAs: def.controllerAs,
        bindings: def.bindings ?? bindingsFromDefs(def.inputs, def.outputs),
      });
    }

    for (const state of sub.states) registry.register(state);

    // `titles` / `resolveKeys` → los `Map`s vivos del closure de `RouterModule`.
    for (const [key, value] of sub.titles) out.titles.set(key, value);
    for (const [key, value] of sub.resolveKeys) out.resolveKeys.set(key, value);

    const $transitions = transition.injector().get("$transitions") as TransitionsLike;
    for (const guard of sub.guards) wireGuardHook($transitions, guard);
    for (const binding of sub.deactivateGuards) wireDeactivateHook($transitions, binding);
    for (const binding of sub.matchGuards) wireMatchHook($transitions, binding);

    // Reemplazar el future state por el `stateName` real (pass-through, sin componente
    // propio — los hijos renderizan en el `<ui-view>` ancestro, como en Angular).
    registry.deregister(`${stateName}.**`);
    registry.register({ name: stateName, url, data });
  };
}

/**
 * `redirectTo` (path, relativo al padre o absoluto `/x`) → state name destino.
 * Sin soporte para `../` (fuera del MVP). Si no matchea, se deja el string crudo
 * (UI-Router lo interpretará como pueda).
 */
function resolveRedirect(redirectTo: string, parentPath: string, pathToName: Map<string, string>): string {
  const target = redirectTo.startsWith("/") ? redirectTo.slice(1) : joinPath(parentPath, redirectTo);
  return pathToName.get(target.replace(/^\/|\/$/g, "")) ?? redirectTo;
}

interface WalkCtx {
  out: TranslatedRoutes;
  parentName?: string;
  parentPath: string;
  /** Rutas con `redirectTo` para resolver en 2ª pasada, cuando `pathToName` está completo. */
  redirects: { state: Ng1StateDeclaration; redirectTo: string; parentPath: string }[];
}

function walk(routes: Routes, ctx: WalkCtx): void {
  const usedLocals = new Set<string>();
  routes.forEach((route, index) => {
    const isWildcard = route.path === WILDCARD;
    const local = dedupe(isWildcard ? "__wildcard__" : segmentName(route.path, index), usedLocals);
    const name = ctx.parentName ? `${ctx.parentName}.${local}` : local;
    const fullPath = isWildcard ? `${ctx.parentPath}/**` : joinPath(ctx.parentPath, route.path ?? "");
    // `**` → param greedy `.+` (≥1 char, así no pisa la ruta `/` del root).
    const url = isWildcard ? "/{ngjsCatchAll:.+}" : segmentUrl(route.path);
    const data = route.data ?? {};

    ctx.out.pathToName.set(fullPath.replace(/^\/|\/$/g, ""), name);

    const state: Ng1StateDeclaration = { name, url, data };

    if (route.redirectTo !== undefined) {
      state.redirectTo = route.redirectTo; // se re-resuelve en la 2ª pasada
      ctx.redirects.push({ state, redirectTo: route.redirectTo, parentPath: ctx.parentPath });
    } else if (route.loadComponent) {
      state.lazyLoad = lazyLoadFor(route, name, url, data) as never;
    } else if (route.loadChildren) {
      // Future state: el sufijo `.**` hace que la URL de este segmento matchee
      // como prefijo y dispare `lazyLoad` aunque los hijos no existan todavía.
      state.name = `${name}.**`;
      state.lazyLoad = lazyLoadChildrenFor(route, name, url, fullPath, data, ctx.out) as never;
    } else {
      const comp = componentName(route);
      if (comp) {
        state.component = comp;
        ctx.out.components.push({ name: comp, cls: route.component as Function, stateName: name });
      }
      const resolve = translateResolve(route.resolve, data);
      if (resolve) state.resolve = resolve as never;
    }

    if (route.title !== undefined) ctx.out.titles.set(name, route.title);
    const rk = resolveKeysOf(route.resolve);
    if (rk.length) ctx.out.resolveKeys.set(name, rk);
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

    if (route.children?.length) {
      walk(route.children, { ...ctx, parentName: name, parentPath: fullPath, redirects: ctx.redirects });
    }
  });
}

/** Traduce un árbol de `Routes` a estados, rooteado en `parentName`/`parentPath`. */
function translate(routes: Routes, parentName: string | undefined, parentPath: string): TranslatedRoutes {
  const out: TranslatedRoutes = {
    states: [],
    guards: [],
    deactivateGuards: [],
    matchGuards: [],
    titles: new Map(),
    resolveKeys: new Map(),
    pathToName: new Map(),
    components: [],
  };
  const redirects: WalkCtx["redirects"] = [];
  walk(routes, { out, parentName, parentPath, redirects });

  for (const { state, redirectTo, parentPath: pp } of redirects) {
    state.redirectTo = resolveRedirect(redirectTo, pp, out.pathToName);
  }

  return out;
}

export function routesToStates(routes: Routes): TranslatedRoutes {
  return translate(routes, undefined, "");
}
