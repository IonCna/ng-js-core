import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { forwardRef, resolveForwardRef } from "@/core/di/forward-ref.ts";
import { Inject, Injectable } from "@/core/di/injectable.ts";
import { ReflectInjection } from "@/core/di/reflect.ts";

describe("etapa 3 — forwardRef", () => {
  it("resolveForwardRef desenvuelve el thunk", () => {
    class Foo {
      static readonly $name = "Foo";
    }
    const wrapped = forwardRef(() => Foo);
    expect(resolveForwardRef(wrapped)).toBe(Foo);
  });

  it("resolveForwardRef deja pasar cualquier otro valor tal cual", () => {
    expect(resolveForwardRef("$http")).toBe("$http");
    class Foo {}
    expect(resolveForwardRef(Foo)).toBe(Foo);
  });

  it("ReflectInjection.translate desenvuelve un forwardRef antes de traducir", () => {
    class Foo {
      static readonly $name = "Foo";
    }
    expect(ReflectInjection.translate(forwardRef(() => Foo))).toBe("Foo");
  });

  it("dos clases que se referencian mutuamente vía forwardRef + @Inject", () => {
    // OJO: el parámetro NO se tipa con la clase circular (`Child`/`Parent`) a
    // propósito. `design:paramtypes` arma un array literal que necesita el
    // valor YA evaluado — tipar así crashea con un TDZ real sin importar que
    // `@Inject` lo vaya a pisar. Tipado laxo (`unknown`, o `import type`
    // cross-file) => TS emite `Object` para esa posición, igual que con una
    // interfaz, y `@Inject(forwardRef(...))` la resuelve sin problema.
    @Injectable()
    class Parent {
      static readonly $name = "Parent";
      constructor(@Inject(forwardRef(() => Child)) public child: unknown) {}
    }

    @Injectable()
    class Child {
      static readonly $name = "Child";
      constructor(@Inject(forwardRef(() => Parent)) public parent: unknown) {}
    }

    expect((Parent as unknown as { $inject: string[] }).$inject).toEqual(["Child"]);
    expect((Child as unknown as { $inject: string[] }).$inject).toEqual(["Parent"]);
  });

  it("un forwardRef circular resuelve de verdad contra el $injector real", () => {
    @Injectable()
    class ServiceA {
      static readonly $name = "ServiceA";
      constructor(@Inject(forwardRef(() => ServiceB)) public b: unknown) {}
    }

    @Injectable()
    class ServiceB {
      static readonly $name = "ServiceB";
      // sin ciclo real de instanciación: ServiceB no pide ServiceA para no colgar $injector
      constructor() {}
    }

    const name = "forwardRefTestModule";
    angular.module(name, []).service(ServiceA.$name, ServiceA).service(ServiceB.$name, ServiceB);

    const $injector = angular.injector(["ng", name]);
    const instance = $injector.get<ServiceA>(ServiceA.$name);

    expect(instance.b).toBeInstanceOf(ServiceB);
  });
});
