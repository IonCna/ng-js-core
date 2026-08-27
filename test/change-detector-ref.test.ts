import { describe, expect, test } from "bun:test";
import type { IControllerService, IScope } from "angular";
import { NgChangeDetectorRef as ChangeDetectorRef } from "../src/core/decorators/ng-change-detector-ref";
import { decorNgController } from "../src/core/decorators/ng-controller";

function createScopeHarness() {
  const destroyCallbacks: Array<() => void> = [];
  const state = {
    applyAsyncCalls: 0,
    digestCalls: 0,
    phase: null as string | null,
  };
  const scope = {
    get $$phase() {
      return state.phase;
    },
    $applyAsync: () => {
      state.applyAsyncCalls++;
    },
    $digest: () => {
      state.digestCalls++;
    },
    $on: (event: string, callback: () => void) => {
      if (event === "$destroy") destroyCallbacks.push(callback);
      return () => undefined;
    },
    $parent: null,
  } as unknown as IScope;

  return {
    destroy: () => {
      for (const callback of destroyCallbacks) callback();
    },
    scope,
    state,
  };
}

describe("ChangeDetectorRef", () => {
  test("schedules, detaches and performs explicit local detection", () => {
    const harness = createScopeHarness();
    const changeDetector = new ChangeDetectorRef(harness.scope);

    changeDetector.markForCheck();
    expect(harness.state.applyAsyncCalls).toBe(1);

    changeDetector.detach();
    changeDetector.markForCheck();
    expect(harness.state.applyAsyncCalls).toBe(1);

    changeDetector.detectChanges();
    expect(harness.state.digestCalls).toBe(1);

    changeDetector.reattach();
    expect(harness.state.applyAsyncCalls).toBe(1);
    changeDetector.markForCheck();
    expect(harness.state.applyAsyncCalls).toBe(2);

    harness.state.phase = "$digest";
    changeDetector.markForCheck();
    changeDetector.detectChanges();
    expect(harness.state.applyAsyncCalls).toBe(2);
    expect(harness.state.digestCalls).toBe(1);

    harness.destroy();
    harness.state.phase = null;
    changeDetector.reattach();
    changeDetector.detectChanges();
    expect(harness.state.applyAsyncCalls).toBe(2);
    expect(harness.state.digestCalls).toBe(1);
  });

  test("provides a scope-local instance to each controller", () => {
    const harness = createScopeHarness();
    let injectedReference: unknown;
    const delegate = ((_expression: unknown, locals?: Record<string, unknown>) => {
      injectedReference = locals?.[ChangeDetectorRef.$name];
      return {};
    }) as unknown as IControllerService;
    const controllerService = decorNgController(delegate) as unknown as (
      expression: unknown,
      locals: Record<string, unknown>,
    ) => unknown;

    controllerService({}, { $scope: harness.scope });

    expect(injectedReference).toBeInstanceOf(ChangeDetectorRef);
  });
});
