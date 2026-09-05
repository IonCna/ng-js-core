import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Inject, Injectable, injectable } from "@/core/di/injectable.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";

describe("etapa 3 - injectable() piel JS", () => {
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

  it("injectable(Clase, { id }) estampa $name para providers", () => {
    class Servicio {}

    injectable(Servicio, { id: "app.servicio" });

    expect((Servicio as unknown as { $name: string }).$name).toBe("app.servicio");
  });

  it("injectable({ id, value }) soporta la piel JS object-style", () => {
    class Servicio {}

    const returned = injectable({ id: "app.servicio.object", value: Servicio });

    expect(returned).toBe(Servicio);
    expect((Servicio as unknown as { $name: string }).$name).toBe("app.servicio.object");
  });
});

describe("etapa 3 - @Injectable / @Inject", () => {
  it("resuelve un ctor tipado con clases via design:paramtypes, sin @Inject", () => {
    class Dep {
      static readonly $name = "Dep";
    }

    @Injectable()
    class Servicio {
      constructor(public dep: Dep) {}
    }

    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual(["Dep"]);
  });

  it("@Injectable({ id }) estampa $name y conserva $inject", () => {
    class Dep {
      static readonly $name = "DepForNamedService";
    }

    @Injectable({ id: "app.named.service" })
    class Servicio {
      constructor(public dep: Dep) {}
    }

    expect((Servicio as unknown as { $name: string }).$name).toBe("app.named.service");
    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual(["DepForNamedService"]);
  });

  it("@Injectable respeta $inject manual cuando no hay metadata de ctor", () => {
    @Injectable({ id: "manual.inject.service" })
    class Servicio {
      static get $inject() {
        return ["depManual"];
      }
    }

    expect((Servicio as unknown as { $name: string }).$name).toBe("manual.inject.service");
    expect((Servicio as unknown as { $inject: string[] }).$inject).toEqual(["depManual"]);
  });

  it("@Inject pisa la posicion que design:paramtypes no puede resolver", () => {
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

  it("una clase sin parametros de ctor queda con $inject vacio", () => {
    @Injectable()
    class SinDeps {
      constructor() {}
    }

    expect((SinDeps as unknown as { $inject: string[] }).$inject).toEqual([]);
  });

  it("@Inject en una posicion del medio, con las otras resueltas por tipo", () => {
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

  it("una clase con @Injectable({ id }) se registra como provider con ese id", () => {
    @Injectable({ id: "custom.service" })
    class Servicio {
      value = "ok";
    }

    const name = "injectableNamedProviderTestModule";
    angular.module(name, []).service((Servicio as unknown as { $name: string }).$name, Servicio);

    const $injector = angular.injector(["ng", name]);
    expect($injector.get<Servicio>("custom.service").value).toBe("ok");
  });
});
