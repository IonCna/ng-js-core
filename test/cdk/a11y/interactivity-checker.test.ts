import { afterEach, describe, expect, it } from "vitest";
import { InteractivityChecker } from "@/cdk/a11y/index.ts";

const checker = new InteractivityChecker();
const mounted: HTMLElement[] = [];

function mount<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el);
  mounted.push(el);
  return el;
}

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

describe("etapa 18 (a11y) — InteractivityChecker", () => {
  it("isDisabled", () => {
    const btn = mount(document.createElement("button"));
    expect(checker.isDisabled(btn)).toBe(false);
    btn.disabled = true;
    expect(checker.isDisabled(btn)).toBe(true);
  });

  it("isVisible — descarta [hidden] / display:none / visibility:hidden", () => {
    const div = mount(document.createElement("div"));
    expect(checker.isVisible(div)).toBe(true);
    div.hidden = true;
    expect(checker.isVisible(div)).toBe(false);
    div.hidden = false;
    div.style.display = "none";
    expect(checker.isVisible(div)).toBe(false);
  });

  it("isFocusable — nativos y [tabindex]", () => {
    expect(checker.isFocusable(mount(document.createElement("button")))).toBe(true);
    expect(checker.isFocusable(mount(document.createElement("input")))).toBe(true);
    const a = mount(document.createElement("a"));
    expect(checker.isFocusable(a)).toBe(false); // sin href
    a.setAttribute("href", "#");
    expect(checker.isFocusable(a)).toBe(true);
    const div = mount(document.createElement("div"));
    expect(checker.isFocusable(div)).toBe(false);
    div.setAttribute("tabindex", "0");
    expect(checker.isFocusable(div)).toBe(true);
    div.setAttribute("tabindex", "-1");
    expect(checker.isFocusable(div)).toBe(true); // focuseable programáticamente
  });

  it("isTabbable — tabindex negativo queda fuera", () => {
    const div = mount(document.createElement("div"));
    div.setAttribute("tabindex", "0");
    expect(checker.isTabbable(div)).toBe(true);
    div.setAttribute("tabindex", "-1");
    expect(checker.isTabbable(div)).toBe(false);

    const btn = mount(document.createElement("button"));
    expect(checker.isTabbable(btn)).toBe(true);
    btn.disabled = true;
    expect(checker.isTabbable(btn)).toBe(false);
  });
});
