import type { StateService, Transition, TransitionService } from "@uirouter/angularjs";
import type { ILocationService, IRootScopeService } from "angular";
import { BehaviorSubject, map, type Observable } from "rxjs";
import { Injectable } from "@/core/di/injectable.ts";
import { convertToParamMap, type ParamMap } from "@/router/param-map.ts";
import type { ActivatedRouteSnapshot, Data, ResolveFn } from "@/router/route.ts";
import {
  mergeResolvedData,
  mergeStaticData,
  type ParamsInheritanceStrategy,
  pickRouteTitle,
  pickRouteTitleState,
} from "@/router/route-title.ts";
import { runInRouteContext } from "@/router/state-translator.ts";

type Params = Record<string, string>;

/**
 * Shim de `ActivatedRoute` sobre `$transitions`/`$location` de UI-Router.
 * `params`/`paramMap`/`data`/`title` emiten en cada `onSuccess`; `queryParams`/
 * `queryParamMap`/`fragment` también en cada `$locationChangeSuccess` (la query
 * cambia sin transición). `data` mergea la `data` estática heredada de la
 * cadena (según `paramsInheritanceStrategy`, ver `mergeStaticData`) con los
 * valores de `resolve` desde `transition.injector()`. `snapshot` es el valor
 * actual.
 *
 * Es un servicio único de app (params/data del estado activo más profundo,
 * ya con la herencia de ancestros resuelta — no expone `.parent`/`.children`
 * como árbol navegable). Eso sigue siendo una brecha documentada (Tier 5).
 */
/** Lo provee `RouterModule.forRoot()`. */
@Injectable()
export abstract class ActivatedRoute {
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
    private readonly emptyPathStates: Set<string> = new Set(),
    private readonly paramsInheritanceStrategy: ParamsInheritanceStrategy = "emptyOnly",
    private readonly $injector?: unknown,
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

  private currentChain(): { name: string; data?: Data }[] {
    return (this.$state.$current as unknown as { path?: { name: string; data?: Data }[] }).path ?? [];
  }

  private syncRoute(transition?: Transition): void {
    const params = { ...(this.$state.params as Params) };
    const chain = this.currentChain();

    // `data` = estático (según `paramsInheritanceStrategy`) + valores de `resolve` disponibles (Angular).
    const staticData = mergeStaticData(chain, this.emptyPathStates, this.paramsInheritanceStrategy);
    const data = mergeResolvedData(chain, this.resolveKeys, staticData, transition?.injector());

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
    const picked = pickRouteTitle(chain, this.titles);
    if (picked === undefined) return "";
    if (typeof picked === "string") return picked;
    const titleState = pickRouteTitleState(chain, this.titles) as string;
    const resolved = runInRouteContext(this.$injector, titleState, () =>
      picked({ params, data, queryParams: this.queryParams$.value, fragment: this.fragment$.value }),
    );
    return typeof resolved === "string" ? resolved : "";
  }
}
