import { describe, expect, test } from "bun:test";
import type { IScope } from "angular";
import { ContentChildrenQuery } from "../src/core/contentChildren";
import { ViewQueryRegistry } from "../src/core/decorators/ng-controller";
import type { QueryList } from "../src/core/query-list";
import { ViewChildrenQuery } from "../src/core/viewChildren";

function createScopeHarness() {
  const asyncCallbacks: Array<() => void> = [];
  const destroyCallbacks: Array<() => void> = [];
  const scope = {
    $parent: null,
    $evalAsync: (callback: () => void) => asyncCallbacks.push(callback),
    $on: (event: string, callback: () => void) => {
      if (event === "$destroy") destroyCallbacks.push(callback);
      return () => undefined;
    },
  } as unknown as IScope;

  return {
    destroy: () =>
      destroyCallbacks.forEach((callback) => {
        callback();
      }),
    flush: () =>
      asyncCallbacks.splice(0).forEach((callback) => {
        callback();
      }),
    scope,
  };
}

function createOrderedNode(order: number): Node {
  return {
    compareDocumentPosition: (other: Node) => {
      const otherOrder = (other as Node & { order: number }).order;
      return order < otherOrder ? 4 : 2;
    },
    order,
  } as unknown as Node;
}

describe("dynamic children queries", () => {
  test("coalesces structural updates and preserves DOM order", () => {
    const harness = createScopeHarness();
    const viewQuery = new ViewChildrenQuery<string>("viewItem", undefined, undefined, true);
    const contentQuery = new ContentChildrenQuery<string>("contentItem", true, false, undefined, undefined, true);
    const registry = new ViewQueryRegistry(harness.scope);

    registry.attachController({ contentItems: contentQuery, viewItems: viewQuery });

    const viewItems = viewQuery.value as QueryList<string>;
    const contentItems = contentQuery.value as QueryList<string>;
    const viewSnapshots: string[][] = [];
    const contentSnapshots: string[][] = [];
    viewItems.changes.subscribe((items) => viewSnapshots.push(items.toArray()));
    contentItems.changes.subscribe((items) => contentSnapshots.push(items.toArray()));

    const firstNode = createOrderedNode(1);
    const secondNode = createOrderedNode(2);
    registry.connectReference("viewItem", "second", new Map(), secondNode);
    const disconnectFirstView = registry.connectReference("viewItem", "first", new Map(), firstNode);
    registry.connectContentReference("contentItem", "second", new Map(), secondNode);
    const disconnectFirstContent = registry.connectContentReference("contentItem", "first", new Map(), firstNode);

    harness.flush();

    expect(viewItems.toArray()).toEqual(["first", "second"]);
    expect(contentItems.toArray()).toEqual(["first", "second"]);
    expect(viewSnapshots).toEqual([["first", "second"]]);
    expect(contentSnapshots).toEqual([["first", "second"]]);

    disconnectFirstView();
    disconnectFirstContent();
    harness.flush();

    expect(viewSnapshots).toEqual([["first", "second"], ["second"]]);
    expect(contentSnapshots).toEqual([["first", "second"], ["second"]]);
    harness.destroy();
  });
});
