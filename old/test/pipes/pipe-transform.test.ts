import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { Pipe } from "@/core/metadata/pipe.ts";
import { createPipeFilter, type PipeTransform } from "@/pipes/pipe-transform.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

function bootWithFilter(name: string, filterName: string, Clase: Function, template: string): { host: HTMLElement; $rootScope: angular.IRootScopeService } {
  const moduleName = uniqueName(name);
  angular.module(moduleName, []).filter(filterName, createPipeFilter(Clase));

  const host = document.createElement("div");
  host.innerHTML = template;
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [moduleName], { strictDi: false });
  return { host, $rootScope: injector.get<angular.IRootScopeService>("$rootScope") };
}

describe("etapa 11 — PipeTransform / createPipeFilter", () => {
  it("una clase @Pipe se registra como .filter() real y transforma el valor en el template", () => {
    @Pipe({ name: "shout" })
    class ShoutPipe implements PipeTransform<string, string> {
      transform(value: string): string {
        return `${value}!!!`;
      }
    }

    const { host, $rootScope } = bootWithFilter("pipeTransformTest", "shout", ShoutPipe, "{{ 'hola' | shout }}");
    $rootScope.$digest();

    expect(host.textContent?.trim()).toBe("hola!!!");
  });

  it("una clase @Pipe con dependencias de ctor las resuelve vía DI real", () => {
    @Injectable()
    class Prefixer {
      static readonly $name = "Prefixer";
      apply(value: string): string {
        return `[${value}]`;
      }
    }

    @Injectable()
    @Pipe({ name: "prefixed" })
    class PrefixedPipe implements PipeTransform<string, string> {
      constructor(private readonly prefixer: Prefixer) {}
      transform(value: string): string {
        return this.prefixer.apply(value);
      }
    }

    const moduleName = uniqueName("pipeTransformDiTest");
    angular
      .module(moduleName, [])
      .service(Prefixer.$name, Prefixer)
      .filter("prefixed", createPipeFilter(PrefixedPipe));

    const host = document.createElement("div");
    host.innerHTML = "{{ 'hola' | prefixed }}";
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [moduleName], { strictDi: false });
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.textContent?.trim()).toBe("[hola]");
  });

  it("pure:false marca $stateful en la función que $filter(name) devuelve; pure:true (default) no", () => {
    // No pude demostrar con un binding real una diferencia observable de
    // $stateful (probé interpolación normal y one-time-binding `::`, en
    // ambos casos el resultado fue igual con y sin la marca) — así que acá
    // solo verificamos lo que SÍ es responsabilidad nuestra: que
    // createPipeFilter ponga la marca en el lugar correcto (confirmado
    // leyendo `isStateless()` en angular.js: chequea `$filter(name).$stateful`,
    // la función de ADENTRO, no el factory de registro).
    @Pipe({ name: "impureCount", pure: false })
    class ImpureCountPipe implements PipeTransform {
      transform(value: unknown[]): number {
        return value.length;
      }
    }

    @Pipe({ name: "pureCount" })
    class PureCountPipe implements PipeTransform {
      transform(value: unknown[]): number {
        return value.length;
      }
    }

    const moduleName = uniqueName("pipeStatefulTest");
    angular
      .module(moduleName, [])
      .filter("impureCount", createPipeFilter(ImpureCountPipe))
      .filter("pureCount", createPipeFilter(PureCountPipe));

    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [moduleName], { strictDi: false });
    const $filter = injector.get<angular.IFilterService>("$filter");

    expect(($filter("impureCount") as unknown as { $stateful?: boolean }).$stateful).toBe(true);
    expect(($filter("pureCount") as unknown as { $stateful?: boolean }).$stateful).toBeUndefined();
  });
});
