import type { IRootScopeService } from "angular";
import { type Observable, Subject } from "rxjs";

export interface NgZoneOptions {
  /** Accepted for Angular API compatibility; long async stacks require Zone.js task instrumentation. */
  readonly enableLongStackTrace?: boolean;
  /** Accepted for compatibility; this adapter does not patch browser event tasks. */
  readonly shouldCoalesceEventChangeDetection?: boolean;
  /** Coalesces consecutive `run()` calls into a single AngularJS `$applyAsync` cycle. */
  readonly shouldCoalesceRunChangeDetection?: boolean;
}

const rootScopeOption = Symbol("NgZone.rootScope");

interface AngularJsNgZoneOptions extends NgZoneOptions {
  readonly [rootScopeOption]: IRootScopeService;
}

let currentZone: NgZone | undefined;

/**
 * AngularJS change-detection adapter with Angular's `NgZone` execution syntax.
 *
 * It does not patch native async APIs. Code scheduled with `setTimeout`, promises,
 * or event listeners does not inherit the current context automatically; call
 * `run()` from that callback when the resulting model change must enter a digest.
 */
export class NgZone {
  private readonly errorSubject = new Subject<unknown>();
  private readonly microtaskEmptySubject = new Subject<void>();
  private readonly rootScope?: IRootScopeService;
  private readonly stableSubject = new Subject<void>();
  private readonly unstableSubject = new Subject<void>();
  private pendingCoalescedDigest = false;
  private pendingCompletionMicrotask = false;
  private stable = true;

  readonly onUnstable: Observable<void> = this.unstableSubject.asObservable();
  readonly onMicrotaskEmpty: Observable<void> = this.microtaskEmptySubject.asObservable();
  readonly onStable: Observable<void> = this.stableSubject.asObservable();
  readonly onError: Observable<unknown> = this.errorSubject.asObservable();

  constructor(private readonly options: NgZoneOptions) {
    this.rootScope = (options as Partial<AngularJsNgZoneOptions>)[rootScopeOption];
  }

  get hasPendingMacrotasks(): boolean {
    return this.pendingCoalescedDigest;
  }

  get hasPendingMicrotasks(): boolean {
    return this.pendingCompletionMicrotask;
  }

  get isStable(): boolean {
    return this.stable && !this.hasPendingMacrotasks && !this.hasPendingMicrotasks;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Matches Angular's public NgZone signature.
  run<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any[]): T {
    return this.executeInside(fn, applyThis, applyArgs);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Matches Angular's public NgZone signature.
  runTask<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any[], _name?: string): T {
    return this.executeInside(fn, applyThis, applyArgs);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Matches Angular's public NgZone signature.
  runGuarded<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any[]): T {
    try {
      return this.executeInside(fn, applyThis, applyArgs);
    } catch (error) {
      this.errorSubject.next(error);
      return undefined as T;
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Matches Angular's public NgZone signature.
  runOutsideAngular<T>(fn: (...args: any[]) => T): T {
    const previousZone = currentZone;
    currentZone = undefined;

    try {
      return fn();
    } finally {
      currentZone = previousZone;
    }
  }

  static isInAngularZone(): boolean {
    return currentZone !== undefined;
  }

  static assertInAngularZone(): void {
    if (!NgZone.isInAngularZone()) {
      throw new Error("Expected to be in Angular Zone, but it is not");
    }
  }

  static assertNotInAngularZone(): void {
    if (NgZone.isInAngularZone()) {
      throw new Error("Expected to not be in Angular Zone, but it is");
    }
  }

  static get $name(): string {
    return "ng.zone";
  }

  // biome-ignore lint/suspicious/noExplicitAny: Implements Angular's public NgZone callbacks internally.
  private executeInside<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any[]): T {
    const previousZone = currentZone;
    const entersThisZone = previousZone !== this;
    const beginsTurn = entersThisZone && this.stable;

    currentZone = this;

    if (beginsTurn) {
      this.stable = false;
      this.unstableSubject.next();
    }

    try {
      return fn.apply(applyThis, applyArgs ?? []);
    } finally {
      currentZone = previousZone;

      if (beginsTurn) {
        this.requestChangeDetection();
      }
    }
  }

  private requestChangeDetection(): void {
    const rootScope = this.rootScope;

    if (!rootScope || rootScope.$$phase) {
      this.completeTurn();
      return;
    }

    if (this.options.shouldCoalesceRunChangeDetection) {
      if (this.pendingCoalescedDigest) return;

      this.pendingCoalescedDigest = true;
      rootScope.$applyAsync(() => {
        this.pendingCoalescedDigest = false;
        this.pendingCompletionMicrotask = true;
        queueMicrotask(() => {
          this.pendingCompletionMicrotask = false;
          this.completeTurn();
        });
      });
      return;
    }

    try {
      rootScope.$digest();
    } finally {
      this.completeTurn();
    }
  }

  private completeTurn(): void {
    this.microtaskEmptySubject.next();
    this.stable = true;
    this.stableSubject.next();
  }
}

export function ngZoneFactory($rootScope: IRootScopeService, options: NgZoneOptions = {}): NgZone {
  return new NgZone({
    ...options,
    [rootScopeOption]: $rootScope,
  } as AngularJsNgZoneOptions);
}
