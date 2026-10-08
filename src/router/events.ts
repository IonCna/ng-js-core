/**
 * Eventos del `Router` — subconjunto de `@angular/router`. Se emiten por
 * `Router.events` a partir de los hooks de `$transitions` de UI-Router (los de
 * navegación) y de la carga de las rutas lazy (`RouteConfigLoad*`).
 */
import type { Route } from "@/router/route.ts";

export class NavigationStart {
  readonly type = "NavigationStart" as const;
  constructor(
    readonly id: number,
    readonly url: string,
  ) {}
}

export class NavigationEnd {
  readonly type = "NavigationEnd" as const;
  constructor(
    readonly id: number,
    readonly url: string,
    readonly urlAfterRedirects: string,
  ) {}
}

export class NavigationCancel {
  readonly type = "NavigationCancel" as const;
  constructor(
    readonly id: number,
    readonly url: string,
    readonly reason: string,
  ) {}
}

export class NavigationError {
  readonly type = "NavigationError" as const;
  constructor(
    readonly id: number,
    readonly url: string,
    readonly error: unknown,
  ) {}
}

/** Empieza a bajar el chunk de una ruta lazy (`loadChildren`/`loadComponent`): al navegar o al precargar. */
export class RouteConfigLoadStart {
  readonly type = "RouteConfigLoadStart" as const;
  constructor(readonly route: Route) {}
}

/** El chunk de la ruta lazy terminó de cargar. Si la carga falla no se emite (la navegación da `NavigationError`). */
export class RouteConfigLoadEnd {
  readonly type = "RouteConfigLoadEnd" as const;
  constructor(readonly route: Route) {}
}

export type RouterEvent =
  | NavigationStart
  | NavigationEnd
  | NavigationCancel
  | NavigationError
  | RouteConfigLoadStart
  | RouteConfigLoadEnd;
