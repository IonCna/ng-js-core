import type angular from "angular";
import { catchError, from, isObservable, type Observable, of } from "rxjs";
import type { Route } from "@/router/route.ts";
import {
  appLazyRoutes,
  type LazyLoadContext,
  type LazyRouteEntry,
  type StateRegistryLike,
} from "@/router/state-translator.ts";

/**
 * Estrategia de preloading — misma forma que `@angular/router`. `fn()` baja y
 * registra el chunk de la ruta (`loadChildren`/`loadComponent`); la estrategia
 * decide si llamarlo.
 */
export abstract class PreloadingStrategy {
  abstract preload(route: Route, fn: () => Observable<unknown>): Observable<unknown>;
}

/** Precarga todas las rutas lazy lo antes posible (errores de carga se ignoran). */
export class PreloadAllModules implements PreloadingStrategy {
  preload(_route: Route, fn: () => Observable<unknown>): Observable<unknown> {
    return fn().pipe(catchError(() => of(null)));
  }
}

/** No precarga nada — el default. */
export class NoPreloading implements PreloadingStrategy {
  preload(): Observable<unknown> {
    return of(null);
  }
}

export type PreloadingStrategyType = new (...args: never[]) => PreloadingStrategy;

/**
 * `RouterPreloader` de Angular sobre UI-Router: después de cada navegación exitosa
 * recorre las rutas lazy del registro que falten y le pasa cada una a la
 * estrategia. Cuando un chunk termina de cargar, sus rutas lazy anidadas entran al
 * registro y se vuelve a recorrer (Angular precarga también los hijos cargados).
 */
export class RouterPreloader {
  private readonly requested = new Set<LazyRouteEntry>();

  constructor(
    private readonly strategy: PreloadingStrategy,
    private readonly context: LazyLoadContext,
  ) {}

  static create(Strategy: PreloadingStrategyType, $injector: angular.auto.IInjectorService): RouterPreloader {
    // Con `@Injectable()` se construye con su `ɵfac` (DI del constructor); sin decorador, sin argumentos.
    const factory = Object.hasOwn(Strategy, "ɵfac")
      ? (Strategy as unknown as { ɵfac: unknown[] }).ɵfac
      : [() => new Strategy()];
    const strategy = $injector.invoke<PreloadingStrategy>(factory as never);
    const $uiRouter = $injector.get<{ stateRegistry: StateRegistryLike }>("$uiRouter");
    return new RouterPreloader(strategy, { stateRegistry: $uiRouter.stateRegistry, $injector });
  }

  preload(): void {
    for (const entry of appLazyRoutes.of(this.context.$injector)) {
      if (this.requested.has(entry) || entry.isLoaded(this.context.$injector)) continue;
      this.requested.add(entry);

      const result = this.strategy.preload(entry.route, () => from(this.load(entry)));
      if (isObservable(result)) result.subscribe({ error: () => this.requested.delete(entry) });
    }
  }

  private async load(entry: LazyRouteEntry): Promise<void> {
    try {
      await entry.load(this.context);
    } catch (error) {
      this.requested.delete(entry); // permite reintentar en la próxima navegación
      throw error;
    }
    this.preload(); // rutas lazy anidadas del chunk recién cargado
  }
}
