import { describe, expect, test } from "bun:test";
import type angular from "angular";
import type { IControllerService, IScope } from "angular";
import { ChangeDetectorRef as ChangeDetectorRefContract } from "../src/core/abstractions/change-detector-ref";
import { ViewRef, ViewRefImpl } from "../src/core/abstractions/view-ref";
import { NgChangeDetectorRef as ChangeDetectorRef } from "../src/core/decorators/ng-change-detector-ref";
import { decorNgController } from "../src/core/decorators/ng-controller";

function createScopeHarness() {
  const destroyCallbacks: Array<() => void> = [];
  const state = {
    applyAsyncCalls: 0,
    digestCalls: 0,
    suspendCalls: 0,
    resumeCalls: 0,
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
    $suspend: () => {
      state.suspendCalls++;
    },
    $resume: () => {
      state.resumeCalls++;
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
  test("is the direct base abstraction of ViewRef", () => {
    const harness = createScopeHarness();

    expect(Object.getPrototypeOf(ViewRef.prototype)).toBe(ChangeDetectorRefContract.prototype);
    expect(new ViewRefImpl(harness.scope)).toBeInstanceOf(ChangeDetectorRefContract);
    expect(ChangeDetectorRefContract.$name).toBe("ChangeDetectorRef");
  });

  test("schedules, detaches and performs explicit local detection", () => {
    const harness = createScopeHarness();
    const changeDetector = new ChangeDetectorRef(harness.scope);

    changeDetector.markForCheck();
    expect(harness.state.applyAsyncCalls).toBe(1);

    changeDetector.detach();
    expect(harness.state.suspendCalls).toBe(1);
    changeDetector.markForCheck();
    expect(harness.state.applyAsyncCalls).toBe(1);

    changeDetector.detectChanges();
    expect(harness.state.digestCalls).toBe(1);

    changeDetector.reattach();
    expect(harness.state.resumeCalls).toBe(1);
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
    const controllerService = decorNgController(delegate, {} as angular.auto.IInjectorService) as unknown as (
      expression: unknown,
      locals: Record<string, unknown>,
    ) => unknown;

    controllerService({}, { $scope: harness.scope });

    expect(injectedReference).toBeInstanceOf(ChangeDetectorRef);
  });
});
