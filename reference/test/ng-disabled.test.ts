import { describe, expect, test } from "bun:test";
import type { IAttributes } from "angular";
import { NgDisabledImpl } from "../src/core/abstractions/ng-disabled";
import { NgDisabledDecorator } from "../src/core/decorators/ng-disabled";

describe("NgDisabled", () => {
  test("stores state and stops notifying removed listeners", () => {
    const disabled = new NgDisabledImpl();
    const changes: boolean[] = [];
    const stopListening = disabled.onChange((value) => changes.push(value));

    disabled.setDisabled(true);
    disabled.setDisabled(true);
    stopListening();
    disabled.setDisabled(false);

    expect(disabled.disabled).toBe(false);
    expect(changes).toEqual([true]);
  });

  test("keeps AngularJS attribute observation in a thin wrapper", () => {
    let observer: ((value: boolean) => void) | undefined;
    const attrs = {
      $observe: (_name: string, callback: (value: boolean) => void) => {
        observer = callback;
        return () => undefined;
      },
    } as unknown as IAttributes;
    const disabled = new NgDisabledDecorator(attrs);

    disabled.$onInit();
    observer?.(true);

    expect(disabled.disabled).toBe(true);
  });
});
