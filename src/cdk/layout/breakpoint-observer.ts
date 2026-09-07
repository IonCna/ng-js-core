import {
  combineLatest,
  concat,
  debounceTime,
  map,
  Observable,
  type Observer,
  skip,
  startWith,
  Subject,
  take,
  takeUntil,
} from "rxjs";
import { NgZone } from "@/core/platform/ng-zone.ts";
import type { BreakpointState } from "@/cdk/layout/breakpoints.ts";
import { MediaMatcher } from "@/cdk/layout/media-matcher.ts";

interface Query {
  observable: Observable<{ query: string; matches: boolean }>;
  mql: MediaQueryList;
}

/** `["a, b", "c"]` → `["a", "b", "c"]` (una media query compuesta se parte por coma). */
function splitQueries(queries: readonly string[]): string[] {
  return queries
    .map((query) => query.split(","))
    .reduce((a1, a2) => a1.concat(a2), [])
    .map((query) => query.trim());
}

/**
 * `BreakpointObserver` — observa media queries de forma reactiva. Port de
 * `@angular/cdk/layout`. El callback de cambio del `MediaQueryList` corre dentro
 * de `NgZone.run()` para que el `$digest` lo levante (viewport cruza un breakpoint
 * → la vista se refresca sola).
 */
export abstract class BreakpointObserver {
  static readonly $name = "BreakpointObserver";
  abstract isMatched(value: string | readonly string[]): boolean;
  abstract observe(value: string | readonly string[]): Observable<BreakpointState>;
  abstract ngOnDestroy(): void;
}

export class BreakpointObserverImpl extends BreakpointObserver {
  static readonly $inject = [MediaMatcher.$name, NgZone.$name];

  private readonly queries = new Map<string, Query>();
  private readonly destroySubject = new Subject<void>();

  constructor(
    private readonly mediaMatcher: MediaMatcher,
    private readonly zone: NgZone,
  ) {
    super();
  }

  ngOnDestroy(): void {
    this.destroySubject.next();
    this.destroySubject.complete();
  }

  isMatched(value: string | readonly string[]): boolean {
    const queries = splitQueries(coerceArray(value));
    return queries.some((query) => this.registerQuery(query).mql.matches);
  }

  observe(value: string | readonly string[]): Observable<BreakpointState> {
    const queries = splitQueries(coerceArray(value));
    const observables = queries.map((query) => this.registerQuery(query).observable);

    let stateObservable = combineLatest(observables);
    // Primer estado sincrónico; los siguientes coalescidos en un tick.
    stateObservable = concat(
      stateObservable.pipe(take(1)),
      stateObservable.pipe(skip(1), debounceTime(0)),
    );

    return stateObservable.pipe(
      map((breakpointStates) => {
        const response: BreakpointState = { matches: false, breakpoints: {} };
        for (const { matches, query } of breakpointStates) {
          response.matches = response.matches || matches;
          response.breakpoints[query] = matches;
        }
        return response;
      }),
    );
  }

  private registerQuery(query: string): Query {
    const cached = this.queries.get(query);
    if (cached) return cached;

    const mql = this.mediaMatcher.matchMedia(query);

    const queryObservable = new Observable((observer: Observer<MediaQueryList>) => {
      const handler = (e: MediaQueryListEvent) => this.zone.run(() => observer.next(e as unknown as MediaQueryList));
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }).pipe(
      startWith(mql),
      map((nextMql) => ({ query, matches: (nextMql as MediaQueryList).matches })),
      takeUntil(this.destroySubject),
    );

    const output: Query = { observable: queryObservable, mql };
    this.queries.set(query, output);
    return output;
  }
}

function coerceArray<T>(value: T | readonly T[]): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}
