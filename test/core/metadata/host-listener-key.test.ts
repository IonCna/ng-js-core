import { describe, expect, it } from "vitest";
import { HostListenerKeySpec } from "@/core/metadata/host-listener-key.ts";

const keydown = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("HostListenerKeySpec", () => {
  it("un evento sin sufijo de tecla escucha el evento tal cual", () => {
    const spec = new HostListenerKeySpec("click");
    expect(spec.domEventName).toBe("click");
    expect(spec.isPlainEvent).toBe(true);
    expect(spec.matches(new MouseEvent("click"))).toBe(true);
  });

  it("filtra por `event.key` normalizado (ArrowUp → arrowup, ' ' → space)", () => {
    const arrowUp = new HostListenerKeySpec("keydown.arrowup");
    expect(arrowUp.domEventName).toBe("keydown");
    expect(arrowUp.matches(keydown({ key: "ArrowUp" }))).toBe(true);
    expect(arrowUp.matches(keydown({ key: "ArrowDown" }))).toBe(false);

    const space = new HostListenerKeySpec("keydown.space");
    expect(space.matches(keydown({ key: " " }))).toBe(true);
  });

  it("exige los modificadores declarados, en cualquier orden", () => {
    const shiftTab = new HostListenerKeySpec("keydown.shift.tab");
    expect(shiftTab.matches(keydown({ key: "Tab", shiftKey: true }))).toBe(true);
    expect(shiftTab.matches(keydown({ key: "Tab" }))).toBe(false);
    expect(shiftTab.matches(keydown({ key: "Tab", shiftKey: true, ctrlKey: true }))).toBe(false);

    // orden de modificadores irrelevante
    expect(new HostListenerKeySpec("keydown.control.shift.a").matches(keydown({ key: "a", ctrlKey: true, shiftKey: true }))).toBe(
      true,
    );
  });

  it("un evento no-teclado nunca matchea una spec con tecla", () => {
    expect(new HostListenerKeySpec("keydown.enter").matches(new MouseEvent("click"))).toBe(false);
  });

  it("segmentos que no son modificadores → spec inválida, nunca matchea", () => {
    const bogus = new HostListenerKeySpec("keydown.foo.enter");
    expect(bogus.domEventName).toBe("keydown");
    expect(bogus.matches(keydown({ key: "Enter" }))).toBe(false);
  });
});
