import "zone.js/node";
import { describe, expect, test } from "bun:test";
import type { IRootScopeService } from "angular";
import { createNgDigestZone } from "../src/platform-browser/ng-digest-zone";

function createRootScopeHarness() {
  const state = { digests: 0, phase: null as string | null };
  const rootScope = {
    get $$phase() {
      return state.phase;
    },
    $digest: () => {
      state.digests++;
    },
  } as unknown as IRootScopeService;

  return { rootScope, state };
}

const flushMacrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createNgDigestZone", () => {
  test("runs one guarded digest after a native promise settles inside the zone", async () => {
    const harness = createRootScopeHarness();
    const zone = createNgDigestZone(() => harness.rootScope);

    zone.run(() => {
      void Promise.resolve().then(() => undefined);
    });

    expect(zone.stable).toBe(false);

    await flushMacrotask();

    expect(harness.state.digests).toBe(1);
    expect(zone.stable).toBe(true);
  });

  test("does not digest for async work scheduled with runOutside", async () => {
    const harness = createRootScopeHarness();
    const zone = createNgDigestZone(() => harness.rootScope);

    zone.runOutside(() => {
      void Promise.resolve().then(() => undefined);
    });

    await flushMacrotask();

    expect(harness.state.digests).toBe(0);
  });

  test("skips the digest while AngularJS already has one in progress", async () => {
    const harness = createRootScopeHarness();
    harness.state.phase = "$digest";
    const zone = createNgDigestZone(() => harness.rootScope);

    zone.run(() => {
      void Promise.resolve().then(() => undefined);
    });

    await flushMacrotask();

    expect(harness.state.digests).toBe(0);
  });

  test("coalesces a chain of promise continuations into a single digest", async () => {
    const harness = createRootScopeHarness();
    const zone = createNgDigestZone(() => harness.rootScope);

    zone.run(() => {
      void Promise.resolve()
        .then(() => undefined)
        .then(() => undefined)
        .then(() => undefined);
    });

    await flushMacrotask();

    expect(harness.state.digests).toBe(1);
  });
});
