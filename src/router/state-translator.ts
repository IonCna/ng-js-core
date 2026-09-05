import type { Ng1StateDeclaration } from "@uirouter/angularjs";
import { bindingsFromDefs } from "@/core/metadata/component-bindings.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import type {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Data,
  ResolveData,
  ResolveFn,
  Route,
  Routes,
} from "@/router/route.ts";

export interface GuardBinding {
  stateName: string;
  canActivate: CanActivateFn[];
  data: Data;
  /** `true` → aplica a los descendientes de `stateName` (`canActivateChild`), no al estado en sí. */
  forChildren?: boolean;
}

export interface TranslatedRoutes {
  states: Ng1StateDeclaration[];
  guards: GuardBinding[];
  /** `title` por state name — el `.run` de `RouterModule` setea `document.title`. */
  titles: Map<string, string | ResolveFn<string>>;
  /** Keys de `resolve` por state name — `ActivatedRoute.data` las mergea desde `transition.injector()`. */
  resolveKeys: Map<string, string[]>;
  /** State name para `$urlRouterProvider.otherwise` (la ruta `**`), si hay. */
  wildcardState?: string;
  /** Full path desde root → state name (para resolver `redirectTo`). */
  pathToName: Map<string, string>;
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
    } else {
      const comp = componentName(route);
      if (comp) state.component = comp;
      const resolve = translateResolve(route.resolve, data);
      if (resolve) state.resolve = resolve as never;
    }

    if (route.title !== undefined) ctx.out.titles.set(name, route.title);
    const rk = resolveKeysOf(route.resolve);
    if (rk.length) ctx.out.resolveKeys.set(name, rk);
    if (isWildcard) ctx.out.wildcardState = name; // último gana

    ctx.out.states.push(state);

    if (route.canActivate?.length) {
      ctx.out.guards.push({ stateName: name, canActivate: route.canActivate, data });
    }
    if (route.canActivateChild?.length) {
      ctx.out.guards.push({ stateName: name, canActivate: route.canActivateChild, data, forChildren: true });
    }

    if (route.children?.length) {
      walk(route.children, { ...ctx, parentName: name, parentPath: fullPath, redirects: ctx.redirects });
    }
  });
}

export function routesToStates(routes: Routes): TranslatedRoutes {
  const out: TranslatedRoutes = {
    states: [],
    guards: [],
    titles: new Map(),
    resolveKeys: new Map(),
    pathToName: new Map(),
  };
  const redirects: WalkCtx["redirects"] = [];
  walk(routes, { out, parentPath: "", redirects });

  for (const { state, redirectTo, parentPath } of redirects) {
    state.redirectTo = resolveRedirect(redirectTo, parentPath, out.pathToName);
  }

  return out;
}
