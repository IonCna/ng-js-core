import { describe, expect, test } from "bun:test";
import type angular from "angular";
import type { ICompileService, IRootScopeService, IScope } from "angular";
import { createComponent } from "../src/core/decorators/ng-create-component";

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  parentNode: FakeElement | null = null;

  constructor(public readonly localName: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentNode?.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) child.parentNode = null;
    this.children.splice(0, this.children.length);
    this.append(...children);
  }

  removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    child.parentNode = null;
  }

  insertBefore(child: FakeElement, reference: FakeElement): void {
    child.parentNode?.removeChild(child);
    const index = this.children.indexOf(reference);
    child.parentNode = this;
    this.children.splice(index === -1 ? this.children.length : index, 0, child);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector !== "[data-ngjs-projectable-node]") return [];

    return this.children.flatMap((child) => [
      ...(child.attributes.has("data-ngjs-projectable-node") ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}

describe("createComponent", () => {
  test("creates a detached host view with options and deterministic cleanup", async () => {
    const originalDocument = globalThis.document;
    const mount = new FakeElement("main");
    const projectedNode = new FakeElement("projected-content");
    const changes: angular.IOnChangesObject[] = [];
    const instance = {
      title: "Initial",
      $onChanges: (value: angular.IOnChangesObject) => changes.push(value),
    };
    const state = {
      destroyCalls: 0,
      linkedScope: undefined as IScope | undefined,
      suspendCalls: 0,
    };
    const destroyCallbacks: Array<() => void> = [];
    const ownerScope = {
      $$phase: null,
      $applyAsync: () => undefined,
      $destroy: () => {
        state.destroyCalls++;
        for (const callback of destroyCallbacks) callback();
      },
      $digest: () => undefined,
      $on: (event: string, callback: () => void) => {
        if (event === "$destroy") destroyCallbacks.push(callback);
        return () => undefined;
      },
      $resume: () => undefined,
      $suspend: () => {
        state.suspendCalls++;
      },
    } as unknown as IScope;
    const rootScope = {
      $new: () => ownerScope,
    } as unknown as IRootScopeService;
    const $compile = ((element: FakeElement) => (scope: IScope) => {
      state.linkedScope = scope;
      expect(element.children).toHaveLength(1);
      expect(element.children[0]).not.toBe(projectedNode);
      expect(element.children[0].attributes.get("data-ngjs-projectable-node")).toBe("0");
      const linked = [element] as unknown as angular.IAugmentedJQuery;
      linked.controller = () => instance;
      return linked;
    }) as unknown as ICompileService;
    const $q = {
      when: <T>(value: T | PromiseLike<T>) => Promise.resolve(value),
    };
    const injector = {
      get: (name: string) => {
        if (name === "$compile") return $compile;
        if (name === "$rootScope") return rootScope;
        if (name === "$q") return $q;
        throw new Error(`Unexpected dependency: ${name}`);
      },
    } as angular.auto.IInjectorService;

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: (name: string) => new FakeElement(name),
      },
    });

    try {
      const componentRef = await createComponent<typeof instance>("rootWidget", {
        environmentInjector: injector,
        hostElement: mount as unknown as Element,
        projectableNodes: [[projectedNode as unknown as Node]],
        directives: ["focusTrap"],
        bindings: [{ title: "Initial" }],
      });
      const host = componentRef.location.nativeElement as unknown as FakeElement;

      expect(globalThis.createComponent).toBe(createComponent);
      expect(host.localName).toBe("root-widget");
      expect(mount.children).toEqual([host]);
      expect(host.children).toEqual([projectedNode]);
      expect(host.attributes.get("focus-trap")).toBe("");
      expect(host.attributes.get("title")).toBe("title");
      expect((state.linkedScope as unknown as Record<string, unknown>).title).toBe("Initial");
      expect(state.suspendCalls).toBe(1);

      componentRef.setInput("title", "Updated");
      expect(instance.title).toBe("Updated");
      expect(changes).toHaveLength(1);
      expect(changes[0].title.previousValue).toBe("Initial");
      expect(changes[0].title.currentValue).toBe("Updated");
      expect(changes[0].title.isFirstChange()).toBe(false);

      let destroyCallbacksCount = 0;
      componentRef.onDestroy(() => destroyCallbacksCount++);
      componentRef.destroy();
      componentRef.destroy();

      expect(destroyCallbacksCount).toBe(1);
      expect(state.destroyCalls).toBe(1);
      expect(mount.children).toEqual([]);
      expect(() => componentRef.setInput("title", "Late")).toThrow("destruido");
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    }
  });
});
