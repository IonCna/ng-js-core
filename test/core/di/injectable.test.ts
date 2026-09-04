import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Inject, Injectable } from "@/core/di/injectable.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";

describe("etapa 3 — @Injectable / @Inject", () => {
  it("resuelve un ctor tipado con clases vía design:paramtypes, sin @Inject", () => {
    class Dep {
      static readonly $name = "Dep";
    }

    @Injectable()
    class Servicio {
      constructor(public dep: Dep) {}
    }

    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual(["Dep"]);
  });

  it("@Inject pisa la posición que design:paramtypes no puede resolver (string -> String global)", () => {
    const API_URL = new InjectionToken<string>("API_URL");

    @Injectable()
    class Servicio {
      constructor(@Inject(API_URL) public apiUrl: string) {}
    }

    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual([API_URL.toString()]);
  });

  it("mezcla una dependencia por tipo y otra por @Inject en el mismo ctor", () => {
    class Dep {
      static readonly $name = "Dep";
    }
    const API_URL = new InjectionToken<string>("API_URL");

    @Injectable()
    class Servicio {
      constructor(
        public dep: Dep,
        @Inject(API_URL) public apiUrl: string,
      ) {}
    }

    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual(["Dep", API_URL.toString()]);
  });

  it("el $inject resultante conecta con el $injector real de AngularJS", () => {
    const API_URL = new InjectionToken<string>("API_URL");

    class Dep {
      static readonly $name = "Dep";
    }

    @Injectable()
    class Servicio {
      constructor(
        public dep: Dep,
        @Inject(API_URL) public apiUrl: string,
      ) {}
    }

    const name = "injectableTestModule";
    angular
      .module(name, [])
      .service(Dep.$name, Dep)
      .constant(API_URL.toString(), "https://example.test")
      .service("servicio", Servicio);

    const $injector = angular.injector(["ng", name]);
    const instance = $injector.get<Servicio>("servicio");

    expect(instance.dep).toBeInstanceOf(Dep);
    expect(instance.apiUrl).toBe("https://example.test");
  });
});
