import { describe, expect, test } from "bun:test";
import type { IRootScopeService } from "angular";
import { NgZone, ngZoneFactory } from "../src/core/ng-zone";

function createRootScopeHarness() {
  const applyAsyncCallbacks: Array<() => void> = [];
  let digests = 0;
  const rootScope = {
    $$phase: null,
    $applyAsync: (callback: () => void) => applyAsyncCallbacks.push(callback),
    $digest: () => {
      digests++;
    },
  } as unknown as IRootScopeService;

  return {
    get digests() {
      return digests;
    },
    flushApplyAsync: () => {
      for (const callback of applyAsyncCallbacks.splice(0)) callback();
      digests++;
    },
    rootScope,
  };
}

describe("NgZone", () => {
  test("runs synchronously inside the Angular context and refreshes the root scope", () => {
    const harness = createRootScopeHarness();
    const zone = ngZoneFactory(harness.rootScope);
    const events: string[] = [];
    zone.onUnstable.subscribe(() => events.push("unstable"));
    zone.onMicrotaskEmpty.subscribe(() => events.push("microtaskEmpty"));
    zone.onStable.subscribe(() => events.push("stable"));

    const result = zone.run(
      function (this: { base: number }, increment: number) {
        expect(NgZone.isInAngularZone()).toBe(true);
        return this.base + increment;
      },
      { base: 2 },
      [3],
    );

    expect(result).toBe(5);
    expect(harness.digests).toBe(1);
    expect(events).toEqual(["unstable", "microtaskEmpty", "stable"]);
    expect(zone.isStable).toBe(true);
  });

  test("runs outside without starting another digest", () => {
    const harness = createRootScopeHarness();
    const zone = ngZoneFactory(harness.rootScope);

    zone.runOutsideAngular(() => {
      expect(NgZone.isInAngularZone()).toBe(false);
      NgZone.assertNotInAngularZone();
    });

    expect(harness.digests).toBe(0);
    expect(() => NgZone.assertInAngularZone()).toThrow();
  });

  test("forwards guarded errors without rethrowing them", () => {
    const harness = createRootScopeHarness();
    const zone = ngZoneFactory(harness.rootScope);
    const errors: unknown[] = [];
    zone.onError.subscribe((error) => errors.push(error));
    const expectedError = new Error("guarded");

    const result = zone.runGuarded(() => {
      throw expectedError;
    });

    expect(result).toBeUndefined();
    expect(errors).toEqual([expectedError]);
    expect(harness.digests).toBe(1);
  });

  test("coalesces change detection requested by consecutive runs", async () => {
    const harness = createRootScopeHarness();
    const zone = ngZoneFactory(harness.rootScope, {
      shouldCoalesceRunChangeDetection: true,
    });
    let stableEvents = 0;
    zone.onStable.subscribe(() => stableEvents++);

    zone.run(() => undefined);
    zone.runTask(() => undefined, undefined, undefined, "second task");

    expect(zone.hasPendingMacrotasks).toBe(true);
    expect(zone.isStable).toBe(false);
    expect(stableEvents).toBe(0);

    harness.flushApplyAsync();

    expect(zone.hasPendingMacrotasks).toBe(false);
    expect(zone.hasPendingMicrotasks).toBe(true);
    expect(zone.isStable).toBe(false);

    await Promise.resolve();

    expect(zone.hasPendingMicrotasks).toBe(false);
    expect(zone.isStable).toBe(true);
    expect(stableEvents).toBe(1);
    expect(harness.digests).toBe(1);
  });
});
