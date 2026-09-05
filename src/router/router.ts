import type { TransitionService } from "@uirouter/angularjs";
import type { ILocationService, IRootScopeService } from "angular";

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
  abstract navigateByUrl(url: string, extras?: NavigationExtras): Promise<boolean>;
  abstract navigate(commands: unknown[], extras?: NavigationExtras): Promise<boolean>;
}

export class RouterImpl extends Router {
  static readonly $inject = ["$location", "$transitions", "$rootScope"] as const;

  constructor(
    private readonly $location: ILocationService,
    private readonly $transitions: TransitionService,
    private readonly $rootScope: IRootScopeService,
  ) {
    super();
  }

  get url(): string {
    return this.$location.url();
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
}
