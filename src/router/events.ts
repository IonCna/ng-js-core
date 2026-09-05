/**
 * Eventos del `Router` — subconjunto de `@angular/router`. Se emiten por
 * `Router.events` a partir de los hooks de `$transitions` de UI-Router.
 */

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

export type RouterEvent = NavigationStart | NavigationEnd | NavigationCancel | NavigationError;
