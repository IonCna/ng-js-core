/**
 * `ngjs-core/router` — superficie de `@angular/router` (path-based) sobre
 * `@uirouter/angularjs`. Ver CONCEPTOS "Router" y `docs/ORDEN-DE-CONSTRUCCION.md`
 * etapa 16.
 */
export { ActivatedRoute } from "@/router/activated-route.ts";
export { convertToParamMap, type ParamMap } from "@/router/param-map.ts";
export type {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  CanActivateFn,
  CanDeactivateFn,
  CanMatchFn,
  Data,
  LoadChildrenCallback,
  LoadComponentCallback,
  ResolveData,
  ResolveFn,
  Route,
  Routes,
} from "@/router/route.ts";
export { type NavigationExtras, Router } from "@/router/router.ts";
export { RouterModule } from "@/router/router-module.ts";
