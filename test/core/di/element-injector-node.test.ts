import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ElementInjectorNode } from "@/runtime/element-injector-node.ts";
import { Injectable } from "@/core/di/injectable.ts";

function fakeAppInjector(services: Record<string, unknown> = {}) {
  return {
    has: (name: string) => Object.hasOwn(services, name),
    get: (name: string) => services[name],
  } as unknown as angular.auto.IInjectorService;
}

describe("etapa 5 — ElementInjectorNode", () => {
  it("useValue: devuelve el valor tal cual y lo cachea (misma referencia en llamadas repetidas)", () => {
    class Token {
      static readonly $name = "Token";
    }
    const value = { hola: "mundo" };
    const node = new ElementInjectorNode([{ provide: Token, useValue: value }], undefined, fakeAppInjector());

    expect(node.get(Token)).toBe(value);
    expect(node.get(Token)).toBe(value);
  });

  it("useClass: instancia una sola vez, cachea la instancia", () => {
    class Service {
      static readonly $name = "Service";
    }
    class Token {
      static readonly $name = "Token";
    }
    const node = new ElementInjectorNode([{ provide: Token, useClass: Service }], undefined, fakeAppInjector());

    const a = node.get(Token);
    const b = node.get(Token);
    expect(a).toBeInstanceOf(Service);
    expect(a).toBe(b);
  });

  it("una clase provider resuelve sus propios ctor deps contra el mismo nodo", () => {
    @Injectable()
    class Dep {
      static readonly $name = "Dep";
    }
    @Injectable()
    class Service {
      static readonly $name = "Service";
      constructor(public dep: Dep) {}
    }
    const node = new ElementInjectorNode([Dep, Service], undefined, fakeAppInjector());

    const service = node.get<Service>(Service);
    expect(service.dep).toBeInstanceOf(Dep);
  });

  it("useFactory: resuelve deps contra el nodo y llama la factory", () => {
    class Dep {
      static readonly $name = "Dep";
    }
    class Token {
      static readonly $name = "Token";
    }
    const factory = vi.fn((dep: unknown) => ({ dep }));
    const node = new ElementInjectorNode(
      [{ provide: Dep, useValue: "dep-value" }, { provide: Token, useFactory: factory, deps: [Dep] }],
      undefined,
      fakeAppInjector(),
    );

    const result = node.get<{ dep: unknown }>(Token);
    expect(factory).toHaveBeenCalledWith("dep-value");
    expect(result.dep).toBe("dep-value");
  });

  it("useExisting: alias a otro token del mismo nodo", () => {
    class Real {
      static readonly $name = "Real";
    }
    class Alias {
      static readonly $name = "Alias";
    }
    const node = new ElementInjectorNode(
      [{ provide: Real, useValue: "real-value" }, { provide: Alias, useExisting: Real }],
      undefined,
      fakeAppInjector(),
    );

    expect(node.get(Alias)).toBe("real-value");
  });

  it("multi: devuelve un array con todos los providers de ese token", () => {
    class Token {
      static readonly $name = "Token";
    }
    const node = new ElementInjectorNode(
      [
        { provide: Token, useValue: "a", multi: true },
        { provide: Token, useValue: "b", multi: true },
      ],
      undefined,
      fakeAppInjector(),
    );

    expect(node.get(Token)).toEqual(["a", "b"]);
  });

  it("no está en el propio nodo: sube a parent", () => {
    class Token {
      static readonly $name = "Token";
    }
    const parent = new ElementInjectorNode([{ provide: Token, useValue: "from-parent" }], undefined, fakeAppInjector());
    const child = new ElementInjectorNode([], parent, fakeAppInjector());

    expect(child.get(Token)).toBe("from-parent");
  });

  it("no está en ningún nodo: cae al $injector de la app", () => {
    class Token {
      static readonly $name = "Token";
    }
    const node = new ElementInjectorNode([], undefined, fakeAppInjector({ Token: "from-app" }));

    expect(node.get(Token)).toBe("from-app");
  });

  it("nada lo resuelve: lanza por default", () => {
    class Token {
      static readonly $name = "Token";
    }
    const node = new ElementInjectorNode([], undefined, fakeAppInjector());

    expect(() => node.get(Token)).toThrow();
  });

  it("@Optional: devuelve null en vez de lanzar cuando nada lo resuelve", () => {
    class Token {
      static readonly $name = "Token";
    }
    const node = new ElementInjectorNode([], undefined, fakeAppInjector());

    expect(node.get(Token, { optional: true })).toBeNull();
  });

  it("@Self: no sube a parent aunque el padre lo tenga", () => {
    class Token {
      static readonly $name = "Token";
    }
    const parent = new ElementInjectorNode([{ provide: Token, useValue: "from-parent" }], undefined, fakeAppInjector());
    const child = new ElementInjectorNode([], parent, fakeAppInjector());

    expect(() => child.get(Token, { self: true })).toThrow();
    expect(child.get(Token, { self: true, optional: true })).toBeNull();
  });

  it("@SkipSelf: ignora el provider propio y arranca en parent", () => {
    class Token {
      static readonly $name = "Token";
    }
    const parent = new ElementInjectorNode([{ provide: Token, useValue: "from-parent" }], undefined, fakeAppInjector());
    const child = new ElementInjectorNode([{ provide: Token, useValue: "from-child" }], parent, fakeAppInjector());

    expect(child.get(Token, { skipSelf: true })).toBe("from-parent");
    expect(child.get(Token)).toBe("from-child");
  });

  it("@Host: no cruza a parent — si no está acá, cae directo al $injector de la app (salteando al padre)", () => {
    class Token {
      static readonly $name = "Token";
    }
    const parent = new ElementInjectorNode([{ provide: Token, useValue: "from-parent" }], undefined, fakeAppInjector());
    const child = new ElementInjectorNode([], parent, fakeAppInjector({ Token: "from-app" }));

    expect(child.get(Token, { host: true })).toBe("from-app");
  });

  it("destroy(): llama ngOnDestroy de cada instancia cacheada y limpia el cache", () => {
    const destroyed = vi.fn();
    class Service {
      static readonly $name = "Service";
      ngOnDestroy = destroyed;
    }
    class Token {
      static readonly $name = "Token";
    }
    const node = new ElementInjectorNode([{ provide: Token, useClass: Service }], undefined, fakeAppInjector());
    node.get(Token); // fuerza la instanciación/cacheo

    node.destroy();
    expect(destroyed).toHaveBeenCalledOnce();
  });
});
