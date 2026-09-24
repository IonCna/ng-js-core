import angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { currentInjector, injectionTokenName, InjectorImpl } from "@/core/di/injector.ts";

/** Como lo deja el compilador: `ɵprov.token` es el nombre de DI de la clase o el token. */
function compiled<T extends object>(target: T, token: string): T {
  return Object.assign(target, { ɵprov: { token } });
}

function bootInjector(name: string, configure?: (module: angular.IModule) => void): InjectorImpl {
  const module = angular.module(name, []);
  configure?.(module);
  return new InjectorImpl(angular.injector(["ng", name]));
}

describe("etapa 3 — Injector", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).ɵngjsInjector;
  });

  it("resuelve un servicio nativo de AngularJS por string", () => {
    const injector = bootInjector("injectorTestNative");
    expect(injector.get("$rootScope")).toBe(injector.nativeInjector.get("$rootScope"));
  });

  it("resuelve un InjectionToken por su nombre compilado (ɵprov.token)", () => {
    const API_URL = compiled(new InjectionToken<string>("API_URL"), "API_URL_1234abcd");
    const injector = bootInjector("injectorTestToken", (module) => module.constant("API_URL_1234abcd", "https://example.test"));

    expect(injector.get(API_URL)).toBe("https://example.test");
  });

  it("resuelve una clase por su nombre compilado", () => {
    class Logger {
      log(msg: string) {
        return `log: ${msg}`;
      }
    }
    compiled(Logger, "Logger_1234abcd");
    const injector = bootInjector("injectorTestClass", (module) => module.service("Logger_1234abcd", Logger));

    expect(injector.get(Logger)).toBeInstanceOf(Logger);
  });

  it("un token sin metadata compilada es error claro", () => {
    class Plain {}
    expect(() => injectionTokenName(Plain)).toThrow(/no tiene nombre de DI en runtime/);
  });

  it("devuelve notFoundValue si el token no está registrado", () => {
    const injector = bootInjector("injectorTestMissing");
    expect(injector.get("noExiste", "fallback")).toBe("fallback");
  });

  it("si el token SÍ está registrado, ignora notFoundValue y devuelve el valor real", () => {
    const injector = bootInjector("injectorTestFoundWithFallback", (module) => module.constant("existente", "valor-real"));
    expect(injector.get("existente", "fallback")).toBe("valor-real");
  });

  it("notFoundValue funciona con valores falsy (0, false, cadena vacía, null)", () => {
    const injector = bootInjector("injectorTestFalsyFallback");

    expect(injector.get("noExiste0", 0)).toBe(0);
    expect(injector.get("noExisteFalse", false)).toBe(false);
    expect(injector.get("noExisteVacio", "")).toBe("");
    expect(injector.get("noExisteNull", null)).toBeNull();
  });

  it("currentInjector() envuelve el $injector de la app arrancada (globalThis.ɵngjsInjector)", () => {
    expect(currentInjector()).toBeUndefined();
    const $injector = angular.injector(["ng"]);
    (globalThis as Record<string, unknown>).ɵngjsInjector = $injector;
    expect(currentInjector()?.nativeInjector).toBe($injector);
  });
});
