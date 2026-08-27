import { describe, expect, test } from "bun:test";
import type angular from "angular";
import type { ICompileService, IQService, IRootScopeService, IScope } from "angular";
import { ApplicationRef, ApplicationRefImpl } from "../src/core/abstractions/application-ref";
import { ElementRefImpl } from "../src/core/abstractions/element-ref";
import { ViewContainerRefImpl } from "../src/core/abstractions/view-container-ref";
import { NgZone } from "../src/core/ng-zone";

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  nextSibling: FakeElement | null = null;

  constructor(public readonly localName: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) child.parentNode = null;
    this.children.splice(0, this.children.length, ...children);
    for (const child of children) child.parentNode = this;
  }

  insertBefore(child: FakeElement, reference: FakeElement | null): void {
    child.parentNode?.removeChild(child);
    const index = reference ? this.children.indexOf(reference) : this.children.length;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    child.parentNode = this;
  }

  removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    child.parentNode = null;
  }
}

function createScopeHarness() {
  const childDestroyCallbacks: Array<() => void> = [];
  const state = {
    applyAsyncCalls: 0,
    resumeCalls: 0,
    rootDestroyCalls: 0,
    suspendCalls: 0,
  };
  const childScope = {
    $$phase: null,
    $applyAsync: () => undefined,
    $destroy: () => {
      for (const callback of childDestroyCallbacks) callback();
    },
    $digest: () => undefined,
    $on: (event: string, callback: () => void) => {
      if (event === "$destroy") childDestroyCallbacks.push(callback);
      return () => undefined;
    },
    $resume: () => {
      state.resumeCalls++;
    },
    $suspend: () => {
      state.suspendCalls++;
    },
  } as unknown as IScope;
  const rootScope = {
    $$phase: null,
    $applyAsync: () => {
      state.applyAsyncCalls++;
    },
    $destroy: () => {
      state.rootDestroyCalls++;
    },
    $new: () => childScope,
  } as unknown as IRootScopeService;

  return { childScope, rootScope, state };
}

describe("ApplicationRef", () => {
  test("bootstraps and owns a component host view at the application root", async () => {
    const originalDocument = globalThis.document;
    const originalElement = globalThis.Element;
    const host = new FakeElement("root-widget");
    const instance = { title: "Root" };
    const scopeHarness = createScopeHarness();

    Object.defineProperty(globalThis, "Element", { configurable: true, value: FakeElement });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: (name: string) => new FakeElement(name),
        querySelector: (selector: string) => (selector === "root-widget" ? host : null),
      },
    });

    const $compile = (() => () => {
      const linked = [host] as unknown as angular.IAugmentedJQuery;
      linked.controller = () => instance;
      return linked;
    }) as unknown as ICompileService;
    const injector = {
      get: (name: string) => {
        if (name === "$compile") return $compile;
        if (name === "$rootScope") return scopeHarness.rootScope;
        if (name === "$q") return $q;
        throw new Error(`Unexpected dependency: ${name}`);
      },
    } as angular.auto.IInjectorService;
    const $q = {
      when: <T>(value: T | PromiseLike<T>) => Promise.resolve(value),
    } as unknown as IQService;

    try {
      const applicationRef = new ApplicationRefImpl(scopeHarness.rootScope, $q, injector, new NgZone({}));
      const componentRef = await applicationRef.bootstrap<typeof instance>("rootWidget", {
        bindings: [{ title: "Root" }],
      });

      expect(ApplicationRef.$name).toBe("ApplicationRef");
      expect(componentRef.instance).toBe(instance);
      expect(componentRef.location.nativeElement).toBe(host);
      expect(applicationRef.componentTypes).toEqual(["rootWidget"]);
      expect(applicationRef.components).toEqual([componentRef]);
      expect(applicationRef.viewCount).toBe(1);
      expect(host.attributes.get("title")).toBe("title");
      expect(scopeHarness.state.suspendCalls).toBe(1);
      expect(scopeHarness.state.resumeCalls).toBe(1);

      const containerParent = new FakeElement("parent");
      const anchor = new FakeElement("anchor");
      containerParent.replaceChildren(anchor);
      const viewContainerRef = new ViewContainerRefImpl(new ElementRefImpl(anchor as unknown as HTMLElement), injector);

      expect(() => viewContainerRef.insert(componentRef.hostView)).toThrow("ApplicationRef");

      applicationRef.tick();
      expect(scopeHarness.state.applyAsyncCalls).toBe(1);

      applicationRef.detachView(componentRef.hostView);
      expect(applicationRef.viewCount).toBe(0);
      expect(scopeHarness.state.suspendCalls).toBe(2);

      viewContainerRef.insert(componentRef.hostView);
      expect(viewContainerRef.length).toBe(1);
      expect(scopeHarness.state.resumeCalls).toBe(2);
      expect(() => applicationRef.attachView(componentRef.hostView)).toThrow("container");

      viewContainerRef.detach();
      expect(scopeHarness.state.suspendCalls).toBe(3);

      applicationRef.attachView(componentRef.hostView);
      expect(applicationRef.viewCount).toBe(1);
      expect(scopeHarness.state.resumeCalls).toBe(3);

      componentRef.destroy();
      expect(applicationRef.components).toEqual([]);
      expect(applicationRef.viewCount).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
      Object.defineProperty(globalThis, "Element", { configurable: true, value: originalElement });
    }
  });
});
