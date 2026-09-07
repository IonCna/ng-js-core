import angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { Title } from "@/platform-browser/index.ts";
import { PlatformBrowserModule } from "@/runtime/platform-browser/index.ts";

function bootTitle(): Title {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [PlatformBrowserModule.name], { strictDi: false });
  return injector.get<Title>(Title.$name);
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
