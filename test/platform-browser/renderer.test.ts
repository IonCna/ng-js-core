import { describe, expect, it } from "vitest";
import { type Renderer2, RendererStyleFlags2 } from "@/core/render/renderer.ts";
import { RendererFactory2Impl } from "@/platform-browser/renderer.ts";

/** La lógica del renderer; su provisión por `BrowserModule` la cubre `platform-browser.compiled.test.ts`. */
function bootRenderer(): Renderer2 {
  return new RendererFactory2Impl(document).createRenderer(document.body, null);
}

describe("etapa 20 — platform-browser: Renderer2 / RendererFactory2", () => {
  it("createRenderer siempre devuelve la misma instancia (sin pipeline propio)", () => {
    const host = document.createElement("div");
    const factory = new RendererFactory2Impl(document);
    expect(factory.createRenderer(host, null)).toBe(factory.createRenderer(null, null));
  });

  it("createElement / appendChild / setAttribute / addClass / setStyle / setProperty", () => {
    const renderer = bootRenderer();
    const parent = document.createElement("div");

    const child = renderer.createElement("span") as HTMLElement;
    renderer.appendChild(parent, child);
    expect(parent.contains(child)).toBe(true);

    renderer.setAttribute(child, "data-x", "1");
    expect(child.getAttribute("data-x")).toBe("1");
    renderer.removeAttribute(child, "data-x");
    expect(child.getAttribute("data-x")).toBeNull();

    renderer.addClass(child, "on");
    expect(child.classList.contains("on")).toBe(true);
    renderer.removeClass(child, "on");
    expect(child.classList.contains("on")).toBe(false);

    renderer.setStyle(child, "color", "red");
    expect(child.style.color).toBe("red");
    renderer.setStyle(child, "background-color", "blue", RendererStyleFlags2.DashCase);
    expect(child.style.getPropertyValue("background-color")).toBe("blue");
    renderer.removeStyle(child, "color");
    expect(child.style.color).toBe("");

    renderer.setProperty(child, "id", "foo");
    expect(child.id).toBe("foo");
  });

  it("createText / createComment / setValue / parentNode / nextSibling", () => {
    const renderer = bootRenderer();
    const parent = document.createElement("div");
    const a = renderer.createText("a");
    const b = renderer.createComment("b");
    renderer.appendChild(parent, a);
    renderer.appendChild(parent, b);

    expect(renderer.parentNode(a)).toBe(parent);
    expect(renderer.nextSibling(a)).toBe(b);

    renderer.setValue(a, "cambiado");
    expect((a as Text).data).toBe("cambiado");
  });

  it("insertBefore / removeChild", () => {
    const renderer = bootRenderer();
    const parent = document.createElement("div");
    const first = renderer.createElement("span");
    const second = renderer.createElement("span");
    renderer.appendChild(parent, second);
    renderer.insertBefore(parent, first, second);
    expect(parent.firstChild).toBe(first);

    renderer.removeChild(parent, first);
    expect(parent.contains(first as Node)).toBe(false);
  });

  it("selectRootElement vacía el contenido salvo preserveContent", () => {
    const renderer = bootRenderer();
    const host = document.createElement("div");
    host.id = "root-target";
    host.innerHTML = "<span>viejo</span>";
    document.body.appendChild(host);

    const cleared = renderer.selectRootElement("#root-target") as Element;
    expect(cleared.textContent).toBe("");

    host.innerHTML = "<span>viejo</span>";
    const preserved = renderer.selectRootElement("#root-target", true) as Element;
    expect(preserved.textContent).toBe("viejo");
  });

  it("listen agrega el listener y el unlisten lo saca", () => {
    const renderer = bootRenderer();
    const el = renderer.createElement("button") as HTMLElement;
    document.body.appendChild(el);

    let calls = 0;
    const unlisten = renderer.listen(el, "click", () => {
      calls++;
    });

    el.click();
    expect(calls).toBe(1);

    unlisten();
    el.click();
    expect(calls).toBe(1);
  });
});
