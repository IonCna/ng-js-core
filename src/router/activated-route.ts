import type { StateService, Transition, TransitionService } from "@uirouter/angularjs";
import type { ILocationService, IRootScopeService } from "angular";
import { BehaviorSubject, map, type Observable } from "rxjs";
import { convertToParamMap, type ParamMap } from "@/router/param-map.ts";
import type { ActivatedRouteSnapshot, Data, ResolveFn } from "@/router/route.ts";

type Params = Record<string, string>;

/**
 * Shim de `ActivatedRoute` sobre `$transitions`/`$location` de UI-Router.
 * `params`/`paramMap`/`data`/`title` emiten en cada `onSuccess`; `queryParams`/
 * `queryParamMap`/`fragment` también en cada `$locationChangeSuccess` (la query
 * cambia sin transición). `data` mergea los valores de `resolve` desde
 * `transition.injector()`. `snapshot` es el valor actual.
 *
 * Es un servicio único de app, **plano** (params/data del estado activo más
 * profundo). El árbol `.parent`/`.children`/params-por-nivel es una brecha
 * documentada (Tier 5).
 */
export abstract class ActivatedRoute {
  static readonly $name = "ActivatedRoute";

  abstract readonly params: Observable<Params>;
  abstract readonly paramMap: Observable<ParamMap>;
  abstract readonly queryParams: Observable<Params>;
  abstract readonly queryParamMap: Observable<ParamMap>;
  abstract readonly fragment: Observable<string | null>;
  abstract readonly data: Observable<Data>;
  abstract readonly title: Observable<string>;
  abstract readonly snapshot: ActivatedRouteSnapshot;
}

export class ActivatedRouteImpl extends ActivatedRoute {
  private readonly params$ = new BehaviorSubject<Params>({});
  private readonly queryParams$ = new BehaviorSubject<Params>({});
  private readonly fragment$ = new BehaviorSubject<string | null>(null);
  private readonly data$ = new BehaviorSubject<Data>({});
  private readonly title$ = new BehaviorSubject<string>("");

  snapshot: ActivatedRouteSnapshot = { params: {}, data: {}, queryParams: {}, fragment: null };

  constructor(
    private readonly $state: StateService,
    $transitions: TransitionService,
    private readonly $location: ILocationService,
    $rootScope: IRootScopeService,
    private readonly titles: Map<string, string | ResolveFn<string>> = new Map(),
    private readonly resolveKeys: Map<string, string[]> = new Map(),
  ) {
    super();
    this.syncRoute();
    this.syncLocation();
    $transitions.onSuccess({}, (transition) => this.syncRoute(transition));
    $rootScope.$on("$locationChangeSuccess", () => this.syncLocation());
  }

  get params(): Observable<Params> {
    return this.params$.asObservable();
  }

  get paramMap(): Observable<ParamMap> {
    return this.params$.pipe(map((params) => convertToParamMap(params)));
  }

  get queryParams(): Observable<Params> {
    return this.queryParams$.asObservable();
  }

  get queryParamMap(): Observable<ParamMap> {
    return this.queryParams$.pipe(map((params) => convertToParamMap(params)));
  }

  get fragment(): Observable<string | null> {
    return this.fragment$.asObservable();
  }

  get data(): Observable<Data> {
    return this.data$.asObservable();
  }

  get title(): Observable<string> {
    return this.title$.asObservable();
  }

  private currentChain(): { name: string }[] {
    return (this.$state.$current as unknown as { path?: { name: string }[] }).path ?? [];
  }

  private syncRoute(transition?: Transition): void {
    const params = { ...(this.$state.params as Params) };
    const current = this.$state.$current as unknown as { data?: Data } | undefined;
    const chain = this.currentChain();

    const data: Data = { ...(current?.data ?? {}) };
    // Mergear valores de `resolve` (Angular: `data` = estático + resueltos).
    if (transition) {
      const injector = transition.injector();
      for (const node of chain) {
        for (const key of this.resolveKeys.get(node.name) ?? []) {
          try {
            data[key] = injector.get(key);
          } catch {
            /* aún no resuelto */
          }
        }
      }
    }

    this.params$.next(params);
    this.data$.next(data);
    this.title$.next(this.resolveTitle(chain, params, data));
    this.updateSnapshot({ params, data });
  }

  private syncLocation(): void {
    const queryParams = { ...(this.$location.search() as Params) };
    const fragment = this.$location.hash() || null;
    this.queryParams$.next(queryParams);
    this.fragment$.next(fragment);
    this.updateSnapshot({ queryParams, fragment });
  }

  private updateSnapshot(patch: Partial<ActivatedRouteSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
  }

  private resolveTitle(chain: { name: string }[], params: Params, data: Data): string {
    let title: string | ResolveFn<string> | undefined;
    for (const node of chain) {
      const candidate = this.titles.get(node.name);
      if (candidate !== undefined) title = candidate;
    }
    if (title === undefined) return "";
    if (typeof title === "string") return title;
    const resolved = title({ params, data, queryParams: this.queryParams$.value, fragment: this.fragment$.value });
    return typeof resolved === "string" ? resolved : "";
  }
}
