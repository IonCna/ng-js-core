import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Inject, Injectable, injectable } from "@/core/di/injectable.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";

describe("etapa 3 — injectable() (piel JS)", () => {
  it("resuelve $inject de una clase JS pura, sin decoradores", () => {
    const API_URL = new InjectionToken<string>("API_URL");

    class Servicio {
      static $inject = ["$http", API_URL];
      constructor(
        public http: unknown,
        public apiUrl: string,
      ) {}
    }

    injectable(Servicio);

    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual(["$http", API_URL.toString()]);
  });
});

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

  it("una clase sin parámetros de ctor queda con $inject vacío, sin explotar", () => {
    @Injectable()
    class SinDeps {
      constructor() {}
    }

    expect((SinDeps as unknown as { $inject: string[] }).$inject).toEqual([]);
  });

  it("@Inject en una posición del medio, con las otras resueltas por tipo", () => {
    class Dep1 {
      static readonly $name = "Dep1";
    }
    class Dep3 {
      static readonly $name = "Dep3";
    }
    const TOKEN = new InjectionToken<string>("TOKEN");

    @Injectable()
    class Servicio {
      constructor(
        public dep1: Dep1,
        @Inject(TOKEN) public middle: string,
        public dep3: Dep3,
      ) {}
    }

    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual(["Dep1", TOKEN.toString(), "Dep3"]);
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
