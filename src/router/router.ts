import type { StateService, Transition, TransitionService } from "@uirouter/angularjs";
import type { auto, ILocationService, IRootScopeService } from "angular";
import { type Observable, Subject } from "rxjs";
import { Inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  type RouterEvent,
} from "@/router/events.ts";
import type { Routes } from "@/router/route.ts";
import { routerRegistry } from "@/router/router-registry.ts";
import { routeConfigLoadEvents } from "@/router/state-translator.ts";
import { UrlCommands, type UrlCommandsExtras } from "@/router/url-commands.ts";

export interface NavigationExtras extends UrlCommandsExtras {
  replaceUrl?: boolean;
}

/**
 * `Router` — navegación imperativa sobre `$location`/`$transitions` de UI-Router.
 * `navigate(commands, extras)` arma la URL como Angular (`UrlCommands`: relativos con `relativeTo`, `..`, matriz,
 * `queryParamsHandling`, `fragment`) y delega en `navigateByUrl`. La promesa resuelve cuando la transición de
 * UI-Router completa (o falla).
 */
/** Lo provee `RouterModule.forRoot()`. */
@Injectable()
export abstract class Router {
  abstract get url(): string;
  abstract readonly events: Observable<RouterEvent>;
  /** Las rutas registradas (`forRoot` + `forChild` eager), como `Router.config` de Angular. */
  abstract readonly config: Routes;
  abstract navigateByUrl(url: string, extras?: NavigationExtras): Promise<boolean>;
  abstract navigate(commands: unknown[], extras?: NavigationExtras): Promise<boolean>;
  /** La URL que daría `navigate(commands, extras)` (en Angular, un `UrlTree`; acá su forma serializada). */
  abstract createUrlTree(commands: unknown[], extras?: NavigationExtras): string;
}

const REJECT_ERROR = 6; // RejectType.ERROR de UI-Router; el resto (SUPERSEDED/ABORTED/…) = cancel.

/** Por encima de los hooks `onBefore` de UI-Router (`lazyLoad`) y del router (`canMatch`): `NavigationStart` va primero. */
const NAVIGATION_START_PRIORITY = 10_000;

/** Una navegación ante `Router.events`: el `id` y la URL pedida de la transición que la inició. */
interface NavigationRef {
  readonly id: number;
  readonly url: string;
}

type TransitionRejection = { type?: number; message?: string; detail?: unknown; redirected?: boolean };

/** El destino de una redirección de UI-Router (`TargetState`), que viaja en el `detail` del rechazo. */
type RedirectTarget = { valid?(): boolean; identifier?(): unknown };

/** El error de Angular (`NG04002`) cuando ninguna ruta matchea la URL. */
function cannotMatchError(url: string): Error {
  const segment = url.split(/[?#]/)[0]?.replace(/^\/+/, "") ?? "";
  return new Error(`NG04002: Cannot match any routes. URL Segment: '${segment}'`);
}

/**
 * El destino de una transición redirigida que nadie va a continuar: apunta a un estado que no existe (`redirectTo`
 * a una ruta sin declarar) y UI-Router no llega a crear la transición siguiente. `undefined` si la redirección sigue.
 */
function deadRedirectOf(rejection: TransitionRejection | undefined): RedirectTarget | undefined {
  if (!rejection?.redirected) return undefined;
  const target = rejection.detail as RedirectTarget | undefined;
  return target?.valid?.() === false ? target : undefined;
}

/** Redirigida y con destino: la navegación sigue en la transición que la continúa. */
function isContinued(rejection: TransitionRejection | undefined): boolean {
  return Boolean(rejection?.redirected) && !deadRedirectOf(rejection);
}

/** El error con el que la navegación falló (`NavigationError`); `undefined` si solo se canceló (`NavigationCancel`). */
function navigationErrorOf(rejection: TransitionRejection | undefined): { error: unknown } | undefined {
  const deadRedirect = deadRedirectOf(rejection);
  if (deadRedirect) return { error: cannotMatchError(String(deadRedirect.identifier?.() ?? "")) };
  if (rejection?.type === REJECT_ERROR) return { error: rejection.detail ?? rejection };
  return undefined;
}

@Injectable()
export class RouterImpl extends Router {
  private readonly events$ = new Subject<RouterEvent>();
  /**
   * UI-Router resuelve un `redirectTo` y la carga de una ruta lazy **redirigiendo** la transición: rechaza la
   * original y sigue en otra. En Angular eso es una sola navegación (un `NavigationStart`, un `NavigationEnd`, el
   * mismo `id`): la transición que continúa hereda la navegación de la que viene.
   */
  private readonly navigations = new WeakMap<Transition, NavigationRef>();
  /** URLs que ninguna ruta matcheó (no hay transición de UI-Router): el error con el que falla esa navegación. */
  private readonly unmatched$ = new Subject<Error>();

  constructor(
    @Inject("$location") private readonly $location: ILocationService,
    @Inject("$transitions") private readonly $transitions: TransitionService,
    @Inject("$rootScope") private readonly $rootScope: IRootScopeService,
    @Inject("$state") private readonly $state: StateService,
    @Inject("$injector") private readonly $injector: auto.IInjectorService,
  ) {
    super();
    this.wireEvents();
  }

  get url(): string {
    return this.$location.url();
  }

  get events(): Observable<RouterEvent> {
    return this.events$.asObservable();
  }

  get config(): Routes {
    return routerRegistry.config;
  }

  navigateByUrl(url: string, extras?: NavigationExtras): Promise<boolean> {
    const normalized = url.startsWith("/") ? url : `/${url}`;
    if (this.$location.url() === normalized) return Promise.resolve(true);

    // Como Angular: `true` si navegó, `false` si se canceló (un guard), y rechaza con el error si falló.
    const settled = new Promise<boolean>((resolve, reject) => {
      const settle = (done: () => void) => {
        offSuccess();
        offError();
        unmatched.unsubscribe();
        done();
      };
      const offSuccess = this.$transitions.onSuccess({}, () => settle(() => resolve(true)));
      const offError = this.$transitions.onError({}, (transition) => {
        const rejection = transition.error() as TransitionRejection | undefined;
        // Redirigida (`redirectTo`, ruta lazy recién cargada): la navegación sigue en la transición que la continúa.
        if (isContinued(rejection)) return;
        const failure = navigationErrorOf(rejection);
        settle(() => (failure ? reject(failure.error) : resolve(false)));
      });
      const unmatched = this.unmatched$.subscribe((error) => settle(() => reject(error)));
    });

    if (extras?.replaceUrl) this.$location.replace();
    this.$location.url(normalized);
    if (extras?.queryParams) this.$location.search(extras.queryParams as Record<string, string>);
    if (!this.$rootScope.$$phase) this.$rootScope.$applyAsync();

    return settled;
  }

  navigate(commands: unknown[], extras?: NavigationExtras): Promise<boolean> {
    return this.navigateByUrl(this.createUrlTree(commands, extras), { replaceUrl: extras?.replaceUrl });
  }

  createUrlTree(commands: unknown[], extras?: NavigationExtras): string {
    return UrlCommands.apply(commands, extras, {
      path: this.$location.path(),
      query: this.$location.search() as Record<string, string | string[]>,
      fragment: this.$location.hash() || null,
    });
  }

  private targetUrl(transition: Transition): string {
    // Navegación por URL: la URL pedida ya está en `$location` (el destino puede ser un future state sin cargar).
    if (transition.options().source === "url") return this.$location.url();
    try {
      return this.$state.href(transition.to().name ?? "", transition.params()) ?? this.$location.url();
    } catch {
      return this.$location.url();
    }
  }

  private wireEvents(): void {
    // La carga de un chunk resuelve fuera del digest (import() nativo): se pide uno para quien pinte con el evento.
    routeConfigLoadEvents.of(this.$injector).subscribe((event) => {
      this.events$.next(event);
      if (!this.$rootScope.$$phase) this.$rootScope.$applyAsync();
    });
    this.$transitions.onBefore(
      {},
      (transition) => {
        const origin = transition.redirectedFrom();
        const continued = origin ? this.navigations.get(origin) : undefined;
        if (continued) {
          this.navigations.set(transition, continued);
          return;
        }
        const navigation = this.navigationOf(transition);
        this.events$.next(new NavigationStart(navigation.id, navigation.url));
      },
      { priority: NAVIGATION_START_PRIORITY },
    );
    this.$transitions.onSuccess({}, (transition) => {
      const { id, url } = this.navigationOf(transition);
      this.events$.next(new NavigationEnd(id, url, this.$location.url()));
    });
    this.$transitions.onError({}, (transition) => {
      const rejection = transition.error() as TransitionRejection | undefined;
      if (isContinued(rejection)) return;
      const { id, url } = this.navigationOf(transition);
      const failure = navigationErrorOf(rejection);
      if (failure) {
        this.restoreUrl();
        this.events$.next(new NavigationError(id, url, failure.error));
      } else {
        this.events$.next(new NavigationCancel(id, url, rejection?.message ?? "cancelled"));
      }
    });
  }

  /**
   * La URL no matchea ninguna ruta (y no hay `**`): lo llama el `otherwise` de `RouterModule.forRoot`. En Angular es
   * una navegación que falla: `NavigationStart` → `NavigationError` (`NG04002`), con la URL restaurada.
   */
  handleUnmatchedUrl(): void {
    const url = this.$location.url();
    // No hay transición que dé el `id`: se toma el siguiente del contador de UI-Router, así no se repite.
    const id = (this.$transitions as unknown as { _transitionCount: number })._transitionCount++;
    const error = cannotMatchError(url);
    this.events$.next(new NavigationStart(id, url));
    this.restoreUrl();
    this.events$.next(new NavigationError(id, url, error));
    this.unmatched$.next(error);
  }

  /**
   * Una navegación que falla deja la URL de la última que terminó bien (`restoreHistory` de Angular). UI-Router solo
   * lo hace cuando un guard la aborta; `update()` reemplaza la URL por la que guardó en la última transición exitosa
   * (si no hubo ninguna, no toca nada).
   */
  private restoreUrl(): void {
    this.$injector.get<{ update(): void }>("$urlRouter").update();
  }

  private navigationOf(transition: Transition): NavigationRef {
    let navigation = this.navigations.get(transition);
    if (!navigation) {
      navigation = { id: Number(transition.$id), url: this.targetUrl(transition) };
      this.navigations.set(transition, navigation);
    }
    return navigation;
  }
}
