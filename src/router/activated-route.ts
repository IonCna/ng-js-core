import type { StateService, TransitionService } from "@uirouter/angularjs";
import { BehaviorSubject, map, type Observable } from "rxjs";
import { convertToParamMap, type ParamMap } from "@/router/param-map.ts";
import type { ActivatedRouteSnapshot, Data } from "@/router/route.ts";

type Params = Record<string, string>;

/**
 * Shim de `ActivatedRoute` sobre `$transitions` de UI-Router. `params`/`paramMap`/
 * `data` emiten en cada `onSuccess`; `snapshot` es el valor actual. Es un servicio
 * único de app (no hay árbol de rutas activadas como en Angular real — UI-Router
 * entrega los params del estado actual y punto).
 */
export abstract class ActivatedRoute {
  static readonly $name = "ActivatedRoute";

  abstract readonly params: Observable<Params>;
  abstract readonly paramMap: Observable<ParamMap>;
  abstract readonly data: Observable<Data>;
  abstract readonly snapshot: ActivatedRouteSnapshot;
}

export class ActivatedRouteImpl extends ActivatedRoute {
  static readonly $inject = ["$state", "$transitions"] as const;

  private readonly params$ = new BehaviorSubject<Params>({});
  private readonly data$ = new BehaviorSubject<Data>({});

  snapshot: ActivatedRouteSnapshot = { params: {}, data: {} };

  constructor(
    private readonly $state: StateService,
    $transitions: TransitionService,
  ) {
    super();
    this.sync();
    $transitions.onSuccess({}, () => this.sync());
  }

  get params(): Observable<Params> {
    return this.params$.asObservable();
  }

  get paramMap(): Observable<ParamMap> {
    return this.params$.pipe(map((params) => convertToParamMap(params)));
  }

  get data(): Observable<Data> {
    return this.data$.asObservable();
  }

  private sync(): void {
    const params = { ...(this.$state.params as Params) };
    const current = this.$state.$current as unknown as { data?: Data } | undefined;
    const data = { ...(current?.data ?? {}) };

    this.snapshot = { params, data };
    this.params$.next(params);
    this.data$.next(data);
  }
}
