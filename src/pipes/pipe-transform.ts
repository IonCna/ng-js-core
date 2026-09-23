import type angular from "angular";
import { ensureInject } from "@/core/di/reflect.ts";
import { getPipeDef } from "@/core/metadata/pipe.ts";

export interface PipeTransform<T = unknown, R = unknown> {
  transform(value: T, ...args: unknown[]): R;
}

/**
 * Envuelve una clase `@Pipe`/`pipe()` en un factory de `.filter()` de
 * AngularJS — como el resto del framework (sin codegen todavía, etapa 10),
 * `@Pipe` solo estampa metadata; el registro real sigue siendo manual:
 * `module.filter(getPipeDef(Clase).name, createPipeFilter(Clase))`.
 *
 * `pure: false` (`@Pipe({..., pure: false})`) marca el filtro `$stateful`
 * — el mecanismo NATIVO de AngularJS para que el binding se reevalúe cada
 * digest sin importar si la referencia del valor de entrada cambió
 * (equivalente real a un pipe impuro; no hace falta reimplementar nada,
 * ver CONCEPTOS "pipe puro vs impuro").
 */
export function createPipeFilter(Clase: Function): angular.Injectable<angular.FilterFactory> {
  ensureInject(Clase);
  const deps = (Clase as unknown as { $inject?: readonly string[] }).$inject ?? [];

  const isImpure = getPipeDef(Clase)?.pure === false;

  const factory = (...args: unknown[]): angular.IFilterFunction => {
    const instance = Reflect.construct(Clase as unknown as new (...ctorArgs: unknown[]) => PipeTransform, args);
    const filterFn = (value: unknown, ...pipeArgs: unknown[]) => instance.transform(value, ...pipeArgs);

    // $stateful va en la función que $filter(name) REALMENTE devuelve (la de
    // adentro), no en este factory de registro — confirmado leyendo
    // isStateless() en angular.js: hace `$filter(name).$stateful`.
    if (isImpure) (filterFn as unknown as { $stateful?: boolean }).$stateful = true;
    return filterFn;
  };

  return [...deps, factory] as unknown as angular.Injectable<angular.FilterFactory>;
}
