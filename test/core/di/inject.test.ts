import angular from "angular";
import { afterEach, describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";

/**
 * El `inject()` de RUNTIME: el que corre fuera de una construcción compilada (el compilador reemplaza en build los
 * `inject()` de campos/constructor — ver `di.compiled.test.ts`). Resuelve contra el `$injector` de la app arrancada
 * (`globalThis.ɵngjsInjector`, que deja la plataforma).
 */
function bootInjector(name: string, configure?: (module: angular.IModule) => void): angular.auto.IInjectorService {
  const module = angular.module(name, []);
  configure?.(module);
  const $injector = angular.injector(["ng", name]);
  (globalThis as Record<string, unknown>).ɵngjsInjector = $injector;
  return $injector;
}

/** Como lo deja el compilador: `ɵprov.token` es el nombre de DI. */
function compiled<T extends object>(target: T, token: string): T {
  return Object.assign(target, { ɵprov: { token } });
}

describe("etapa 3 — inject()", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).ɵngjsInjector;
  });

  it("tira un error claro si se llama sin una app arrancada (y { optional } da null)", () => {
    expect(() => inject("$rootScope")).toThrow(/inject\(\)/);
    expect(inject("$rootScope", { optional: true })).toBeNull();
  });

  it("resuelve un servicio nativo de AngularJS por string", () => {
    const $injector = bootInjector("injectTestNative");
    expect(inject("$rootScope")).toBe($injector.get("$rootScope"));
  });

  it("resuelve un InjectionToken (por su nombre compilado) con el tipo inferido", () => {
    const API_URL = compiled(new InjectionToken<string>("API_URL"), "API_URL_1234abcd");
    bootInjector("injectTestToken", (module) => module.constant("API_URL_1234abcd", "https://example.test"));

    const apiUrl: string = inject(API_URL);
    expect(apiUrl).toBe("https://example.test");
  });

  it("resuelve una clase por su nombre compilado", () => {
    class Logger {}
    compiled(Logger, "Logger_1234abcd");
    bootInjector("injectTestClass", (module) => module.service("Logger_1234abcd", Logger));

    expect(inject(Logger)).toBeInstanceOf(Logger);
  });

  it("con { optional: true } devuelve null si el token no está registrado, o el valor real si lo está", () => {
    bootInjector("injectTestOptional", (module) => module.constant("existente", "valor-real"));
    expect(inject("noExiste", { optional: true })).toBeNull();
    expect(inject("existente", { optional: true })).toBe("valor-real");
  });

  it("funciona en código de runtime que corre después (no en una construcción compilada)", () => {
    bootInjector("injectTestLater");

    class Saludo {
      rootScope(): angular.IRootScopeService {
        return inject<angular.IRootScopeService>("$rootScope");
      }
    }

    expect(new Saludo().rootScope()).toBeDefined();
  });
});
