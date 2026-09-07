import angular from "angular";
import { describe, expect, it } from "vitest";
import {
  DOCUMENT,
  PlatformBrowserModule,
  platformBrowserModule,
  providePlatformBrowser,
} from "@/runtime/platform-browser/index.ts";

function boot(mod: angular.IModule) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return angular.bootstrap(host, [mod.name], { strictDi: false });
}

describe("etapa 14 — platform-browser: DOCUMENT", () => {
  it("PlatformBrowserModule es memoizado y depende de ng.js.core", () => {
    expect(platformBrowserModule()).toBe(PlatformBrowserModule);
    expect(providePlatformBrowser()).toBe(PlatformBrowserModule);
    expect(PlatformBrowserModule.requires).toEqual(["ng.js.core"]);
  });

  it("inyectar DOCUMENT devuelve $document[0] (el document global)", () => {
    const injector = boot(PlatformBrowserModule);
    const doc = injector.get<Document>(DOCUMENT.toString());
    expect(doc).toBe(injector.get<angular.IDocumentService>("$document")[0]);
    expect(doc).toBe(document);
  });
});
