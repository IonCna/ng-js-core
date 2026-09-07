import { afterEach, describe, expect, it } from "vitest";
import { FocusTrap, FocusTrapFactory, InteractivityChecker } from "@/cdk/a11y/index.ts";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";

const factory = new FocusTrapFactory(new InteractivityChecker());
const hosts: HTMLElement[] = [];

function mountHost(innerHTML: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = innerHTML;
  document.body.appendChild(host);
  hosts.push(host);
  return host;
}

afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
  // Las anclas se insertan como hermanas del host, no dentro — barrerlas aparte.
  for (const anchor of document.querySelectorAll(".cdk-focus-trap-anchor")) anchor.remove();
});

describe("etapa 18 (a11y) — FocusTrap", () => {
  it("create() acepta HTMLElement o ElementRef", () => {
    const host = mountHost("<button>a</button>");
    expect(factory.create(host)).toBeInstanceOf(FocusTrap);
    expect(factory.create(new ElementRefImpl(host))).toBeInstanceOf(FocusTrap);
  });

  it("attachAnchors inserta anclas antes y después del host", () => {
    const host = mountHost("<button>a</button>");
    const trap = factory.create(host, true);
    expect(document.querySelectorAll(".cdk-focus-trap-anchor")).toHaveLength(0);
    expect(trap.attachAnchors()).toBe(true);

    const anchors = document.querySelectorAll(".cdk-focus-trap-anchor");
    expect(anchors).toHaveLength(2);
    expect(host.previousElementSibling).toBe(anchors[0]);
    expect(host.nextElementSibling).toBe(anchors[1]);
    trap.destroy();
  });

  it("focusFirstTabbableElement / focusLastTabbableElement", () => {
    const host = mountHost("<button id='a'>a</button><input id='b'><a id='c' href='#'>c</a>");
    const trap = factory.create(host);

    expect(trap.focusFirstTabbableElement()).toBe(true);
    expect(document.activeElement?.id).toBe("a");
    expect(trap.focusLastTabbableElement()).toBe(true);
    expect(document.activeElement?.id).toBe("c");
    trap.destroy();
  });

  it("`[cdkFocusInitial]` gana en focusInitialElement", () => {
    const host = mountHost("<button id='a'>a</button><button id='b' cdkFocusInitial>b</button>");
    const trap = factory.create(host);
    expect(trap.focusInitialElement()).toBe(true);
    expect(document.activeElement?.id).toBe("b");
    trap.destroy();
  });

  it("enfocar el ancla de cierre salta al primer tabbable (wrap)", () => {
    const host = mountHost("<button id='a'>a</button><button id='b'>b</button>");
    const trap = factory.create(host);
    const endAnchor = host.nextElementSibling as HTMLElement;

    endAnchor.focus();
    expect(document.activeElement?.id).toBe("a");
    trap.destroy();
  });

  it("destroy() quita las anclas y marca hasAttached=false", () => {
    const host = mountHost("<button>a</button>");
    const trap = factory.create(host);
    expect(trap.hasAttached()).toBe(true);
    trap.destroy();
    expect(document.querySelectorAll(".cdk-focus-trap-anchor")).toHaveLength(0);
    expect(trap.hasAttached()).toBe(false);
  });
});
