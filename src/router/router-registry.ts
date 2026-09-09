import type { ResolveFn } from "@/router/route.ts";

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
 * - `controllerAs` + `moduleNames`: el `controllerAs` del `@NgModule` que importa
 *   el `RouterModule` — fallback para los componentes de ruta **lazy**
 *   (`loadComponent`/`loadChildren`), que no están en ningún `@NgModule` y por eso
 *   no lo heredarían como un componente eager.
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
  readonly pathToName = new Map<string, string>();
  /** `controllerAs` del `@NgModule` que importa el `RouterModule` — fallback para componentes de ruta lazy. */
  controllerAs: string | undefined;
  private readonly moduleNames = new Set<string>();

  mergeTitles(titles: Map<string, string | ResolveFn<string>>): void {
    for (const [key, value] of titles) this.titles.set(key, value);
  }

  mergeResolveKeys(resolveKeys: Map<string, string[]>): void {
    for (const [key, value] of resolveKeys) this.resolveKeys.set(key, value);
  }

  mergePathToName(pathToName: Map<string, string>): void {
    for (const [key, value] of pathToName) this.pathToName.set(key, value);
  }

  /** `RouterModule.forRoot`/`forChild` registran acá el nombre de su `angular.module`. */
  registerModuleName(name: string): void {
    this.moduleNames.add(name);
  }

  hasModuleName(name: string): boolean {
    return this.moduleNames.has(name);
  }

  reset(): void {
    this.titles.clear();
    this.resolveKeys.clear();
    this.pathToName.clear();
    this.controllerAs = undefined;
    this.moduleNames.clear();
  }
}

export const routerRegistry = new RouterRegistry();
