import type { IAugmentedJQuery, IControllerService, IScope } from "angular";
import { NgChangeDetectorRef } from "@/core/decorators/ng-change-detector-ref";
import { popActiveViewQueryRegistry, pushActiveViewQueryRegistry } from "@/core/queries/query-context";
import { ViewQueryRegistry } from "@/core/queries/view-query-registry";

export {
  bindContentQueryOwners,
  getActiveViewQueryRegistry,
  getContentQueryOwners,
  getControllerViewQueryRegistry,
  getScopeViewQueryRegistries,
  getScopeViewQueryRegistry,
  runWithContentQueryOwners,
} from "@/core/queries/query-context";
export { type ControllerViewMetadata, ViewQueryRegistry } from "@/core/queries/view-query-registry";

type ControllerExpression = unknown;

interface ControllerLocals {
  $element?: IAugmentedJQuery;
  $scope?: IScope;
  [name: string]: unknown;
}

interface ControllerInitializer<T = unknown> {
  (): T;
  instance: T;
  identifier?: string;
}

type InternalControllerService = <T = unknown>(
  expression: ControllerExpression,
  locals?: ControllerLocals,
  later?: boolean,
  identifier?: string,
) => T | ControllerInitializer<T>;

function isObject(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function createControllerLocals(locals?: ControllerLocals): ControllerLocals | undefined {
  if (!locals?.$scope || Object.hasOwn(locals, NgChangeDetectorRef.$name)) return locals;

  return {
    ...locals,
    [NgChangeDetectorRef.$name]: new NgChangeDetectorRef(locals.$scope),
  };
}

export const decorNgController = ($delegate: IControllerService): IControllerService => {
  const invokeController = $delegate as unknown as InternalControllerService;

  const decoratedController = <T = unknown>(
    expression: ControllerExpression,
    locals?: ControllerLocals,
    later?: boolean,
    identifier?: string,
  ): T | ControllerInitializer<T> => {
    const controllerLocals = createControllerLocals(locals);

    if (later) {
      const initializer = invokeController<T>(
        expression,
        controllerLocals,
        true,
        identifier,
      ) as ControllerInitializer<T>;
      const registry = new ViewQueryRegistry(
        controllerLocals?.$scope,
        controllerLocals?.$element,
        initializer.identifier ?? identifier,
      );

      const decoratedInitializer = (() => {
        pushActiveViewQueryRegistry(registry);

        try {
          const instance = initializer();
          if (isObject(instance)) registry.attachController(instance);
          return instance;
        } finally {
          popActiveViewQueryRegistry(registry);
        }
      }) as ControllerInitializer<T>;

      Object.defineProperty(decoratedInitializer, "instance", {
        get: () => initializer.instance,
        set: (value: T) => {
          initializer.instance = value;
        },
      });

      Object.defineProperty(decoratedInitializer, "identifier", {
        get: () => initializer.identifier,
      });

      return decoratedInitializer;
    }

    const registry = new ViewQueryRegistry(controllerLocals?.$scope, controllerLocals?.$element, identifier);
    pushActiveViewQueryRegistry(registry);

    try {
      const instance = invokeController<T>(expression, controllerLocals, false, identifier) as T;
      if (isObject(instance)) registry.attachController(instance);
      return instance;
    } finally {
      popActiveViewQueryRegistry(registry);
    }
  };

  return decoratedController as IControllerService;
};

decorNgController.$inject = ["$delegate"];
