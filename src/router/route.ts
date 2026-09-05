import type { Provider } from "@/core/di/provider.ts";
import type { Type } from "@/core/di/provider-token.ts";

/**
 * `Route` es API de autoría — igual a `@angular/router`, path-based. UI-Router
 * (el sustrato real, ver CONCEPTOS "Router") arma un árbol de **estados con
 * nombre** (`$stateProvider.state({ name, url, component })`), no de paths.
 * El `name` de cada estado se deriva de la posición en el árbol (`children`
 * anidados → `padre.hijo`) al registrar — nunca lo escribe el consumidor, así
 * la superficie queda idéntica a Angular real. Esa derivación vive en el
 * traductor (todavía no escrito), no en este archivo — acá solo el tipo.
 */

export type Data = Record<string, unknown>;

export interface ActivatedRouteSnapshot {
  readonly params: Record<string, string>;
  readonly data: Data;
  /** Presentes en `ActivatedRoute.snapshot`; ausentes en el snapshot que reciben guards/resolvers. */
  readonly queryParams?: Record<string, string>;
  readonly fragment?: string | null;
}

export type ResolveFn<T> = (route: ActivatedRouteSnapshot) => T | Promise<T>;

export type ResolveData = Record<string, ResolveFn<unknown> | Type<unknown>>;

export type CanActivateFn = (route: ActivatedRouteSnapshot) => boolean | Promise<boolean>;
export type CanActivateChildFn = CanActivateFn;
export type CanDeactivateFn<T> = (component: T) => boolean | Promise<boolean>;
export type CanMatchFn = (route: Route) => boolean | Promise<boolean>;

/** Ver «UI-Router `lazyLoad` y ESM»: el `import()` nativo se adapta al contrato `{ states }`. */
export type LoadChildrenCallback = () => Promise<{ routes: Routes } | Type<unknown>>;
export type LoadComponentCallback = () => Promise<Type<unknown> | { default: Type<unknown> }>;

export interface Route {
  path?: string;
  pathMatch?: "prefix" | "full";
  component?: Type<unknown>;
  loadComponent?: LoadComponentCallback;
  redirectTo?: string;
  title?: string | ResolveFn<string>;
  canActivate?: CanActivateFn[];
  canActivateChild?: CanActivateChildFn[];
  canDeactivate?: CanDeactivateFn<unknown>[];
  canMatch?: CanMatchFn[];
  data?: Data;
  resolve?: ResolveData;
  children?: Routes;
  loadChildren?: LoadChildrenCallback;
  providers?: Provider[];
}

export type Routes = Route[];
