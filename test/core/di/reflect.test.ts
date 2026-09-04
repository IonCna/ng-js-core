import angular from "angular";
import { describe, expect, it } from "vitest";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { ensureInject, ReflectInjection } from "@/core/di/reflect.ts";

describe("etapa 3 — ReflectInjection", () => {
  it("deja pasar un string tal cual", () => {
    expect(ReflectInjection.translate("$http")).toBe("$http");
  });

  it("traduce un InjectionToken a su id único", () => {
    const token = new InjectionToken("API_URL");
    expect(ReflectInjection.translate(token)).toBe(token.toString());
  });

  it("traduce una clase con static $name", () => {
    class Servicio {
      static readonly $name = "Servicio";
    }
    expect(ReflectInjection.translate(Servicio)).toBe("Servicio");
  });

  it("tira un error claro para un token que no sabe resolver", () => {
    class SinNombre {}
    expect(() => ReflectInjection.translate(SinNombre as never)).toThrow(/ReflectInjection/);
  });

  it("toInject traduce una lista mixta de tokens a $inject", () => {
    const API_URL = new InjectionToken("API_URL");
    class Servicio {
      static readonly $name = "Servicio";
    }

    const $inject = ReflectInjection.toInject(["$http", API_URL, Servicio]);

    expect($inject).toEqual(["$http", API_URL.toString(), "Servicio"]);
  });
});

describe("etapa 3 — ensureInject", () => {
  it("un $inject de puros strings queda igual", () => {
    class Foo {
      static $inject = ["$http", "miServicio"];
    }
    expect(ensureInject(Foo)).toEqual(["$http", "miServicio"]);
  });

  it("resuelve los tokens dentro de $inject a sus strings (JS puro, sin decoradores)", () => {
    const API_URL = new InjectionToken("API_URL");
    class Saludo {
      static $inject = ["$http", API_URL];
    }

    expect(ensureInject(Saludo)).toEqual(["$http", API_URL.toString()]);
    expect(Saludo.$inject).toEqual(["$http", API_URL.toString()]);
  });

  it("sin $inject declarado, no inyecta nada", () => {
    class SinDeps {}
    expect(ensureInject(SinDeps)).toEqual([]);
  });

  it("el $inject resultante conecta con el $injector real de AngularJS", () => {
    class Saludo {
      static $inject = ["$rootScope"];
      constructor(public rootScope: angular.IRootScopeService) {}
    }
    ensureInject(Saludo);

    const name = "ensureInjectTestModule";
    angular.module(name, []).service("saludo", Saludo);

    const $injector = angular.injector(["ng", name]);
    const instance = $injector.get<Saludo>("saludo");

    expect(instance.rootScope).toBe($injector.get("$rootScope"));
  });
});
