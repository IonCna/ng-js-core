import angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Meta } from "@/platform-browser/index.ts";
import { PlatformBrowserModule } from "@/runtime/platform-browser/index.ts";

function bootMeta(): Meta {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [PlatformBrowserModule.name], { strictDi: false });
  return injector.get<Meta>(Meta.$name);
}

afterEach(() => {
  for (const m of Array.from(document.head.querySelectorAll("meta"))) {
    if (m.hasAttribute("name") || m.hasAttribute("property") || m.hasAttribute("http-equiv")) m.remove();
  }
});

describe("etapa 14 — platform-browser: Meta", () => {
  it("addTag crea una <meta> en el <head>; getTag la encuentra", () => {
    const meta = bootMeta();
    const el = meta.addTag({ name: "description", content: "hola" });

    expect(el?.tagName).toBe("META");
    expect(el?.parentElement).toBe(document.head);
    expect(meta.getTag('name="description"')?.getAttribute("content")).toBe("hola");
  });

  it("updateTag reusa la <meta> existente y le pisa el content", () => {
    const meta = bootMeta();
    meta.addTag({ name: "description", content: "v1" });
    meta.updateTag({ name: "description", content: "v2" });

    const tags = meta.getTags('name="description"');
    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute("content")).toBe("v2");
  });

  it("updateTag crea la <meta> si no existe", () => {
    const meta = bootMeta();
    expect(meta.getTag('property="og:title"')).toBeNull();
    meta.updateTag({ property: "og:title", content: "Título" });
    expect(meta.getTag('property="og:title"')?.getAttribute("content")).toBe("Título");
  });

  it("addTag con forceCreation duplica en vez de reusar", () => {
    const meta = bootMeta();
    meta.addTag({ property: "og:image", content: "a.png" });
    meta.addTag({ property: "og:image", content: "b.png" }, true);
    expect(meta.getTags('property="og:image"')).toHaveLength(2);
  });

  it("httpEquiv se mapea a http-equiv; removeTag la saca", () => {
    const meta = bootMeta();
    meta.addTag({ httpEquiv: "content-security-policy", content: "default-src 'self'" });
    const el = meta.getTag('http-equiv="content-security-policy"');
    expect(el?.getAttribute("content")).toBe("default-src 'self'");

    meta.removeTag('http-equiv="content-security-policy"');
    expect(meta.getTag('http-equiv="content-security-policy"')).toBeNull();
  });
});
