import angular from "angular";
import { describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { Injector, InjectorImpl } from "@/core/di/injector.ts";

function bootInjector(name: string, configure?: (module: angular.IModule) => void) {
  const module = angular.module(name, []);
  module.service(Injector.$name, InjectorImpl);
  configure?.(module);
  const $injector = angular.injector(["ng", name]);
  $injector.get(Injector.$name); // fuerza la instanciación para que InjectorImpl.current quede seteado
  return $injector;
}

describe("etapa 3 — inject()", () => {
  it("tira un error claro si se llama antes de bootstrappear", () => {
    // biome-ignore lint: acceso directo para simular "sin bootstrap" en el test
    (InjectorImpl as unknown as { _current?: unknown })._current = undefined;
    expect(() => inject("$rootScope")).toThrow(/inject\(\)/);
  });

  it("resuelve un servicio nativo de AngularJS por string", () => {
    const $injector = bootInjector("injectTestNative");
    expect(inject("$rootScope")).toBe($injector.get("$rootScope"));
  });

  it("resuelve un InjectionToken con el tipo inferido", () => {
    const API_URL = new InjectionToken<string>("API_URL");
    bootInjector("injectTestToken", (module) => {
      module.constant(API_URL.toString(), "https://example.test");
    });

    const apiUrl = inject(API_URL);
    expect(apiUrl).toBe("https://example.test");
  });

  it("resuelve una clase por su static $name", () => {
    class Logger {
      static readonly $name = "Logger";
    }
    bootInjector("injectTestClass", (module) => {
      module.service(Logger.$name, Logger);
    });

    expect(inject(Logger)).toBeInstanceOf(Logger);
  });

  it("devuelve notFoundValue si el token no está registrado", () => {
    bootInjector("injectTestMissing");
    expect(inject("noExiste", "fallback")).toBe("fallback");
  });

  it("funciona como field initializer, con la app ya bootstrappeada", () => {
    bootInjector("injectTestField");

    class Saludo {
      rootScope = inject<angular.IRootScopeService>("$rootScope");
    }

    const instance = new Saludo();
    expect(instance.rootScope).toBeDefined();
  });
});
