import type { StateService, Transition, TransitionService } from "@uirouter/angularjs";
import type { ILocationService, IRootScopeService } from "angular";
import { type Observable, Subject } from "rxjs";
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  type RouterEvent,
} from "@/router/events.ts";

export interface NavigationExtras {
  replaceUrl?: boolean;
  queryParams?: Record<string, string | number | boolean>;
}

/**
 * `Router` — navegación imperativa sobre `$location`/`$transitions` de UI-Router.
 * `navigate(['/x', id])` arma la URL y delega en `navigateByUrl`. La promesa
 * resuelve cuando la transición de UI-Router completa (o falla).
 */
export abstract class Router {
  static readonly $name = "Router";

  abstract get url(): string;
  abstract readonly events: Observable<RouterEvent>;
  abstract navigateByUrl(url: string, extras?: NavigationExtras): Promise<boolean>;
  abstract navigate(commands: unknown[], extras?: NavigationExtras): Promise<boolean>;
}

const REJECT_ERROR = 6; // RejectType.ERROR de UI-Router; el resto (SUPERSEDED/ABORTED/…) = cancel.

export class RouterImpl extends Router {
  static readonly $inject = ["$location", "$transitions", "$rootScope", "$state"] as const;

  private readonly events$ = new Subject<RouterEvent>();

  constructor(
    private readonly $location: ILocationService,
    private readonly $transitions: TransitionService,
    private readonly $rootScope: IRootScopeService,
    private readonly $state: StateService,
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

  navigateByUrl(url: string, extras?: NavigationExtras): Promise<boolean> {
    const normalized = url.startsWith("/") ? url : `/${url}`;
    if (this.$location.url() === normalized) return Promise.resolve(true);

    const settled = new Promise<boolean>((resolve) => {
      const offSuccess = this.$transitions.onSuccess({}, () => {
        offSuccess();
        offError();
        resolve(true);
      });
      const offError = this.$transitions.onError({}, () => {
        offSuccess();
        offError();
        resolve(false);
      });
    });

    if (extras?.replaceUrl) this.$location.replace();
    this.$location.url(normalized);
    if (extras?.queryParams) this.$location.search(extras.queryParams as Record<string, string>);
    if (!this.$rootScope.$$phase) this.$rootScope.$applyAsync();

    return settled;
  }

  navigate(commands: unknown[], extras?: NavigationExtras): Promise<boolean> {
    const path = commands
      .map((segment) => String(segment))
      .join("/")
      .replace(/\/{2,}/g, "/");
    return this.navigateByUrl(path, extras);
  }

  private targetUrl(transition: Transition): string {
    try {
      return this.$state.href(transition.to().name ?? "", transition.params()) ?? this.$location.url();
    } catch {
      return this.$location.url();
    }
  }

  private wireEvents(): void {
    this.$transitions.onBefore({}, (transition) => {
      this.events$.next(new NavigationStart(Number(transition.$id), this.targetUrl(transition)));
    });
    this.$transitions.onSuccess({}, (transition) => {
      this.events$.next(new NavigationEnd(Number(transition.$id), this.targetUrl(transition), this.$location.url()));
    });
    this.$transitions.onError({}, (transition) => {
      const rejection = transition.error() as { type?: number; message?: string; detail?: unknown } | undefined;
      const url = this.targetUrl(transition);
      if (rejection?.type === REJECT_ERROR) {
        this.events$.next(new NavigationError(Number(transition.$id), url, rejection.detail ?? rejection));
      } else {
        this.events$.next(new NavigationCancel(Number(transition.$id), url, rejection?.message ?? "cancelled"));
      }
    });
  }
}
