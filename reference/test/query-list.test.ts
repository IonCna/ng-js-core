import { describe, expect, test } from "bun:test";
import { QueryList } from "../src/core/query-list";

describe("QueryList", () => {
  test("keeps a stable iterable collection", () => {
    const queryList = new QueryList<number>();

    queryList.reset([1, [2, 3]]);

    expect(queryList.length).toBe(3);
    expect(queryList.first).toBe(1);
    expect(queryList.last).toBe(3);
    expect(queryList.toArray()).toEqual([1, 2, 3]);
    expect([...queryList]).toEqual([1, 2, 3]);
  });

  test("emits changes only when identity or order changes", () => {
    const queryList = new QueryList<object>();
    const first = {};
    const second = {};
    const snapshots: object[][] = [];
    const subscription = queryList.changes.subscribe((current) => snapshots.push(current.toArray()));

    queryList.reset([first]);
    queryList.notifyOnChanges();
    queryList.reset([first]);
    queryList.notifyOnChanges();
    queryList.reset([first, second]);
    queryList.notifyOnChanges();
    queryList.reset([second, first]);
    queryList.notifyOnChanges();

    expect(snapshots).toEqual([[first], [first, second], [second, first]]);
    subscription.unsubscribe();
    queryList.destroy();
  });
});
