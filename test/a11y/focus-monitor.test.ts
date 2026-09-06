import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusMonitor, type FocusOrigin } from "@/a11y/index.ts";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";

describe("etapa 18 (a11y) — FocusMonitor", () => {
  let monitor: FocusMonitor;
  let el: HTMLButtonElement;

  beforeEach(() => {
    monitor = new FocusMonitor();
    el = document.createElement("button");
    document.body.appendChild(el);
  });

  afterEach(() => {
    monitor.ngOnDestroy();
    el.remove();
  });

  it("foco programático → 'program' + clase cdk-program-focused", () => {
    const seen: FocusOrigin[] = [];
    monitor.monitor(el).subscribe((o) => seen.push(o));

    el.focus();
    expect(seen).toEqual(["program"]);
    expect(el.classList.contains("cdk-focused")).toBe(true);
    expect(el.classList.contains("cdk-program-focused")).toBe(true);

    el.blur();
    expect(seen).toEqual(["program", null]);
    expect(el.classList.contains("cdk-focused")).toBe(false);
  });

  it("keydown reciente → 'keyboard'", () => {
    const seen: FocusOrigin[] = [];
    monitor.monitor(el).subscribe((o) => seen.push(o));

    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    el.focus();
    expect(seen).toEqual(["keyboard"]);
    expect(el.classList.contains("cdk-keyboard-focused")).toBe(true);
  });

  it("mousedown reciente → 'mouse'", () => {
    const seen: FocusOrigin[] = [];
    monitor.monitor(el).subscribe((o) => seen.push(o));

    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.focus();
    expect(seen).toEqual(["mouse"]);
  });

  it("interacción vieja (fuera del buffer) → 'program'", () => {
    vi.useFakeTimers();
    const seen: FocusOrigin[] = [];
    monitor.monitor(el).subscribe((o) => seen.push(o));

    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    vi.advanceTimersByTime(1000);
    el.focus();
    expect(seen).toEqual(["program"]);
    vi.useRealTimers();
  });

  it("focusVia fuerza el origen", () => {
    const seen: FocusOrigin[] = [];
    monitor.monitor(el).subscribe((o) => seen.push(o));
    monitor.focusVia(el, "touch");
    expect(seen).toEqual(["touch"]);
    expect(el.classList.contains("cdk-touch-focused")).toBe(true);
  });

  it("stopMonitoring completa el Observable y limpia clases", () => {
    let completed = false;
    monitor.monitor(new ElementRefImpl(el)).subscribe({ complete: () => (completed = true) });
    el.focus();
    monitor.stopMonitoring(el);
    expect(completed).toBe(true);
    expect(el.className).toBe("");
  });

  it("monitor() del mismo elemento devuelve el mismo stream", () => {
    const a = monitor.monitor(el);
    const b = monitor.monitor(el);
    expect(a).toBe(b);
  });
});
