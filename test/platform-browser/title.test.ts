import { afterEach, describe, expect, it } from "vitest";
import { type Title, TitleImpl } from "@/platform-browser/index.ts";

/** La lógica del servicio; su provisión por `BrowserModule` la cubre `platform-browser.compiled.test.ts`. */
function bootTitle(): Title {
  return new TitleImpl(document);
}

describe("etapa 14 — platform-browser: Title", () => {
  const original = document.title;
  afterEach(() => {
    document.title = original;
  });

  it("getTitle lee document.title; setTitle lo escribe", () => {
    const title = bootTitle();
    document.title = "inicial";
    expect(title.getTitle()).toBe("inicial");
    title.setTitle("nuevo");
    expect(document.title).toBe("nuevo");
  });

  it("setTitle(nullish) → cadena vacía", () => {
    const title = bootTitle();
    title.setTitle(undefined as unknown as string);
    expect(document.title).toBe("");
  });
});
