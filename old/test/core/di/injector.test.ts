import angular from "angular";
import { describe, expect, it } from "vitest";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { Injector, InjectorImpl } from "@/core/di/injector.ts";

function bootInjector(name: string, configure?: (module: angular.IModule) => void) {
  const module = angular.module(name, []);
  module.service(Injector.$name, InjectorImpl);
  configure?.(module);
  return angular.injector(["ng", name]);
}

describe("etapa 3 — Injector", () => {
  it("resuelve un servicio nativo de AngularJS por string", () => {
    const $injector = bootInjector("injectorTestNative");
    const injector = $injector.get<Injector>(Injector.$name);

    expect(injector.get("$rootScope")).toBe($injector.get("$rootScope"));
  });

  it("resuelve un InjectionToken registrado con su nombre traducido", () => {
    const API_URL = new InjectionToken<string>("API_URL");
    const $injector = bootInjector("injectorTestToken", (module) => {
      module.constant(API_URL.toString(), "https://example.test");
    });
    const injector = $injector.get<Injector>(Injector.$name);

    expect(injector.get(API_URL)).toBe("https://example.test");
  });

  it("resuelve una clase registrada por su static $name", () => {
    class Logger {
      static readonly $name = "Logger";
      log(msg: string) {
        return `log: ${msg}`;
      }
    }
    const $injector = bootInjector("injectorTestClass", (module) => {
      module.service(Logger.$name, Logger);
    });
    const injector = $injector.get<Injector>(Injector.$name);

    expect(injector.get(Logger)).toBeInstanceOf(Logger);
  });

  it("devuelve notFoundValue si el token no está registrado", () => {
    const $injector = bootInjector("injectorTestMissing");
    const injector = $injector.get<Injector>(Injector.$name);

    expect(injector.get("noExiste", "fallback")).toBe("fallback");
  });

  it("si el token SÍ está registrado, ignora notFoundValue y devuelve el valor real", () => {
    const $injector = bootInjector("injectorTestFoundWithFallback", (module) => {
      module.constant("existente", "valor-real");
    });
    const injector = $injector.get<Injector>(Injector.$name);

    expect(injector.get("existente", "fallback")).toBe("valor-real");
  });

  it("notFoundValue funciona con valores falsy (0, false, cadena vacía)", () => {
    const $injector = bootInjector("injectorTestFalsyFallback");
    const injector = $injector.get<Injector>(Injector.$name);

    expect(injector.get("noExiste0", 0)).toBe(0);
    expect(injector.get("noExisteFalse", false)).toBe(false);
    expect(injector.get("noExisteVacio", "")).toBe("");
  });

  it("InjectorImpl.current queda apuntando a la última instancia creada", () => {
    bootInjector("injectorTestCurrent").get(Injector.$name);
    expect(InjectorImpl.current).toBeInstanceOf(InjectorImpl);
  });
});
