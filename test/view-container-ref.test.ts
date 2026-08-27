import { describe, expect, test } from "bun:test";
import type angular from "angular";
import type { IAugmentedJQuery, IControllerService, IScope } from "angular";
import { ViewContainerRef, ViewContainerRefImpl } from "../src/core/abstractions/view-container-ref";
import { decorNgController } from "../src/core/decorators/ng-controller";

function createScopeHarness() {
  const destroyCallbacks: Array<() => void> = [];
  const scope = {
    $on: (event: string, callback: () => void) => {
      if (event === "$destroy") destroyCallbacks.push(callback);
      return () => undefined;
    },
    $parent: null,
  } as unknown as IScope;

  return {
    destroy: () =>
      destroyCallbacks.forEach((callback) => {
        callback();
      }),
    scope,
  };
}

describe("ViewContainerRef controller injection", () => {
  test("provides an element-scoped instance and clears it with the scope", () => {
    const harness = createScopeHarness();
    const element = [{ parentNode: null }] as unknown as IAugmentedJQuery;
    const injected: ViewContainerRef[] = [];
    const delegate = ((_expression: unknown, locals?: Record<string, unknown>) => {
      injected.push(locals?.[ViewContainerRef.$name] as ViewContainerRef);
      return {};
    }) as unknown as IControllerService;
    const controllerService = decorNgController(delegate, {} as angular.auto.IInjectorService) as unknown as (
      expression: unknown,
      locals: Record<string, unknown>,
    ) => unknown;

    controllerService({}, { $element: element, $scope: harness.scope });
    controllerService({}, { $element: element, $scope: harness.scope });

    expect(injected[0]).toBeInstanceOf(ViewContainerRefImpl);
    expect(injected[1]).toBeInstanceOf(ViewContainerRefImpl);
    expect(injected[0]).not.toBe(injected[1]);
    expect(injected[0].element.nativeElement).toBe(element[0]);

    let clearCalls = 0;
    injected[0].clear = () => clearCalls++;
    harness.destroy();

    expect(clearCalls).toBe(1);
  });

  test("preserves an explicitly provided local", () => {
    const provided = {} as ViewContainerRef;
    let injected: unknown;
    const delegate = ((_expression: unknown, locals?: Record<string, unknown>) => {
      injected = locals?.[ViewContainerRef.$name];
      return {};
    }) as unknown as IControllerService;
    const controllerService = decorNgController(delegate, {} as angular.auto.IInjectorService) as unknown as (
      expression: unknown,
      locals: Record<string, unknown>,
    ) => unknown;

    controllerService({}, { [ViewContainerRef.$name]: provided });

    expect(injected).toBe(provided);
  });
});
