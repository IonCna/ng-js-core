import type { Provider } from "@/core/di/provider.ts";
import type { ResolveFn, Routes } from "@/router/route.ts";

/**
 * Registro global del router — el "config único" que `@angular/router` arma con
 * el multi-provider `ROUTES` + un solo `Router`. Acá `RouterModule.forRoot` y
 * cada `RouterModule.forChild` viven en `angular.module`s separados, cada uno con
 * su `.config`/`.run`; este registro es el puente entre ellos:
 *
 * - `titles` / `resolveKeys`: los llena `forRoot` **y** cada `forChild` (y las
 *   ramas lazy de `loadChildren`). Los leen `wireTitles` (`.run` del módulo de
 *   `forRoot`) y el factory de `ActivatedRoute`, en vivo en cada transición — así
 *   el `title` / la `data` resuelta de una ruta declarada por `forChild` dejan de
 *   perderse.
 * - `pathToName`: path absoluto → nombre de estado UI-Router, de **todos** los
 *   árboles. Permite resolver un `redirectTo` que cruza árboles (una ruta de
 *   `forChild` que apunta a un path registrado por `forRoot`, o viceversa).
 *
 * Todos los `forRoot`/`forChild` corren en fase de import (antes del
 * `angular.bootstrap`), así que el registro está completo cuando corren los
 * bloques `.config`. Los merges son idempotentes (misma clave → mismo valor).
 * Vitest aísla el grafo de módulos por archivo; `reset()` es para tests que
 * bootean varias apps distintas en el mismo archivo.
 */
class RouterRegistry {
  readonly titles = new Map<string, string | ResolveFn<string>>();
  readonly resolveKeys = new Map<string, string[]>();
  readonly emptyPathStates = new Set<string>();
  /** State names de rutas `loadChildren` (todas las ramas) — ver `runInRouteContext`. */
  readonly lazyChildrenStates = new Set<string>();
  /** `Route.providers` por state name (todas las ramas). */
  readonly routeProviders = new Map<string, Provider[]>();
  readonly pathToName = new Map<string, string>();
  /**
   * `Routes` de cada `RouterModule.forChild` por nombre de `angular.module` — un
   * `@NgModule` lazy (`loadChildren` → clase) las junta de sus `imports` y las
   * traduce rooteadas en la ruta padre (Angular: multi-provider `ROUTES`).
   */
  private readonly childRoutes = new Map<string, Routes>();

  mergeTitles(titles: Map<string, string | ResolveFn<string>>): void {
    for (const [key, value] of titles) this.titles.set(key, value);
  }

  mergeResolveKeys(resolveKeys: Map<string, string[]>): void {
    for (const [key, value] of resolveKeys) this.resolveKeys.set(key, value);
  }

  mergeEmptyPathStates(emptyPathStates: Set<string>): void {
    for (const name of emptyPathStates) this.emptyPathStates.add(name);
  }

  mergeRouteProviders(routeProviders: Map<string, Provider[]>): void {
    for (const [key, value] of routeProviders) this.routeProviders.set(key, value);
  }

  mergeLazyChildrenStates(names: Set<string>): void {
    for (const name of names) this.lazyChildrenStates.add(name);
  }

  mergePathToName(pathToName: Map<string, string>): void {
    for (const [key, value] of pathToName) this.pathToName.set(key, value);
  }

  registerChildRoutes(moduleName: string, routes: Routes): void {
    this.childRoutes.set(moduleName, routes);
  }

  childRoutesOf(moduleName: string): Routes | undefined {
    return this.childRoutes.get(moduleName);
  }

  reset(): void {
    this.childRoutes.clear();
    this.titles.clear();
    this.resolveKeys.clear();
    this.emptyPathStates.clear();
    this.lazyChildrenStates.clear();
    this.routeProviders.clear();
    this.pathToName.clear();
  }
}

export const routerRegistry = new RouterRegistry();
