/// <reference types="zone.js" />
import type { IRootScopeService } from "angular";

export interface NgDigestZone {
  /** Runs `fn` inside the zone whose async work drives the AngularJS digest. */
  run<T>(fn: () => T): T;
  /** Runs `fn` in the parent zone; work scheduled there never triggers a digest. */
  runOutside<T>(fn: () => T): T;
  /** `false` while the zone still has async work in flight. */
  readonly stable: boolean;
}

type RootScopeAccessor = () => IRootScopeService | undefined;

/**
 * Bridges Zone.js task tracking to the AngularJS digest.
 *
 * Bootstrapping the application inside {@link NgDigestZone.run} makes every
 * native `Promise` continuation, `await`, `queueMicrotask`, `setTimeout` and DOM
 * event handler run in a forked zone. When that zone drains its microtask queue
 * a single guarded `$rootScope.$digest()` runs, so model changes made off the
 * AngularJS services (`$q`, `$timeout`, `$http`) are still reflected in the view.
 *
 * This is the same contract `@angular/upgrade` uses to keep a hybrid app in sync,
 * reduced to the pieces this project needs.
 */
export function createNgDigestZone(getRootScope: RootScopeAccessor): NgDigestZone {
  if (typeof Zone === "undefined") {
    throw new Error('Zone.js no está cargado: importá "zone.js" antes de arrancar la aplicación');
  }

  let nesting = 0;
  let hasPendingMicrotasks = false;
  let stable = true;

  const runDigest = (): void => {
    const rootScope = getRootScope();
    if (!rootScope || rootScope.$$phase) return;
    rootScope.$digest();
  };

  const onEnter = (): void => {
    nesting++;
    if (stable) stable = false;
  };

  const onLeave = (): void => {
    nesting--;
    checkStable();
  };

  const checkStable = (): void => {
    if (nesting === 0 && !hasPendingMicrotasks && !stable) {
      stable = true;
      runDigest();
    }
  };

  const forked = Zone.current.fork({
    name: "ngjsDigestZone",
    properties: { ngjsDigestZone: true },
    onInvoke: (delegate, _current, target, callback, applyThis, applyArgs, source) => {
      onEnter();
      try {
        return delegate.invoke(target, callback, applyThis, applyArgs, source);
      } finally {
        onLeave();
      }
    },
    onInvokeTask: (delegate, _current, target, task, applyThis, applyArgs) => {
      onEnter();
      try {
        return delegate.invokeTask(target, task, applyThis, applyArgs);
      } finally {
        onLeave();
      }
    },
    onHasTask: (delegate, current, target, hasTaskState) => {
      delegate.hasTask(target, hasTaskState);
      if (current !== target) return;
      if (hasTaskState.change === "microTask") {
        hasPendingMicrotasks = hasTaskState.microTask;
        checkStable();
      }
    },
    onHandleError: (delegate, _current, target, error) => {
      const handled = delegate.handleError(target, error);
      queueMicrotask(() => {
        throw error;
      });
      return handled;
    },
  });

  const parentZone = forked.parent ?? Zone.root;

  return {
    run<T>(fn: () => T): T {
      return forked.run(fn);
    },
    runOutside<T>(fn: () => T): T {
      return parentZone.run(fn);
    },
    get stable(): boolean {
      return stable;
    },
  };
}
