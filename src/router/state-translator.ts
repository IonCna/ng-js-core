import type { Ng1StateDeclaration } from "@uirouter/angularjs";
import { bindingsFromDefs } from "@/core/metadata/component-bindings.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { ConfigProviderFactory } from "@/core/platform/config-providers.ts";
import type { ActivatedRouteSnapshot, CanActivateFn, Data, ResolveData, Route, Routes } from "@/router/route.ts";

export interface GuardBinding {
  stateName: string;
  canActivate: CanActivateFn[];
  data: Data;
}

export interface TranslatedRoutes {
  states: Ng1StateDeclaration[];
  guards: GuardBinding[];
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

function segmentName(path: string | undefined, index: number): string {
  const raw = (path ?? "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return raw || `route${index}`;
}

/** URL relativa a la del padre (UI-Router la concatena). Vacío → estado sin URL propia. */
function segmentUrl(path: string | undefined): string {
  const p = path ?? "";
  return p ? `/${p}` : "";
}

function componentName(route: Route): string | undefined {
  if (!route.component) return undefined;
  const def = getComponentDef(route.component);
  if (!def) {
    throw new Error(`RouterModule: el component de la ruta "${route.path ?? ""}" no tiene @Component (ɵcmp).`);
  }
  return toCamelCase(def.selector);
}

/** `resolve: { key: fn }` → forma de UI-Router `{ key: ["$stateParams", ($sp) => fn(snapshot)] }`. */
function translateResolve(resolve: ResolveData | undefined, data: Data): Record<string, unknown> | undefined {
  if (!resolve) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resolve)) {
    if (typeof value !== "function") continue; // Type<T> tokens: fuera del MVP
    out[key] = [
      "$stateParams",
      ($stateParams: Record<string, string>) => {
        const snapshot: ActivatedRouteSnapshot = { params: { ...$stateParams }, data };
        return (value as (r: ActivatedRouteSnapshot) => unknown)(snapshot);
      },
    ];
  }
  return Object.keys(out).length ? out : undefined;
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

function walk(routes: Routes, parentName: string | undefined, out: TranslatedRoutes): void {
  routes.forEach((route, index) => {
    const local = segmentName(route.path, index);
    const name = parentName ? `${parentName}.${local}` : local;
    const url = segmentUrl(route.path);
    const data = route.data ?? {};

    const state: Ng1StateDeclaration = { name, url, data };

    if (route.redirectTo !== undefined) {
      state.redirectTo = route.redirectTo;
    } else if (route.loadComponent) {
      state.lazyLoad = lazyLoadFor(route, name, url, data) as never;
    } else {
      const comp = componentName(route);
      if (comp) state.component = comp;
      const resolve = translateResolve(route.resolve, data);
      if (resolve) state.resolve = resolve as never;
    }

    if (!route.component && !route.loadComponent && !route.redirectTo && route.children?.length) {
      state.abstract = false; // estado "sin componente": solo agrupa hijos
    }

    out.states.push(state);

    if (route.canActivate?.length) {
      out.guards.push({ stateName: name, canActivate: route.canActivate, data });
    }

    if (route.children?.length) walk(route.children, name, out);
  });
}

export function routesToStates(routes: Routes): TranslatedRoutes {
  const out: TranslatedRoutes = { states: [], guards: [] };
  walk(routes, undefined, out);
  return out;
}
