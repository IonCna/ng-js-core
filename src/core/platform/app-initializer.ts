import type angular from "angular";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { injectionTokenName } from "@/core/di/injector.ts";

const APP_INITIALIZERS_GLOBAL = "ɵngjsAppInitializers";

type AppInitializer = (injector: angular.auto.IInjectorService) => void | Promise<unknown>;

/**
 * `APP_INITIALIZER` de Angular: funciones `multi` que corren al arrancar; si alguna devuelve una promesa,
 * `bootstrapModule()` espera a que se resuelva. `{ provide: APP_INITIALIZER, useFactory: ..., deps: [...], multi: true }`.
 */
export const APP_INITIALIZER = new InjectionToken<readonly (() => void | PromiseLike<unknown>)[]>("APP_INITIALIZER");

/**
 * La plataforma que emite `ng-js-compiler` corre, después de `angular.bootstrap`, las funciones de
 * `globalThis.ɵngjsAppInitializers` y espera sus promesas antes de resolver `bootstrapModule()`. Esa es la
 * única puerta: acá se anota UNA función que lee `APP_INITIALIZER` del injector de la app (el token multi,
 * con lo que hayan provisto los módulos) más las de `provideAppInitializer()`.
 */
class AppInitializers {
  static add(initializer: AppInitializer): void {
    const globals = globalThis as typeof globalThis & Record<string, unknown>;
    const list = (globals[APP_INITIALIZERS_GLOBAL] as AppInitializer[] | undefined) ?? [];
    list.push(initializer);
    globals[APP_INITIALIZERS_GLOBAL] = list;
  }

  static fromToken($injector: angular.auto.IInjectorService): Promise<unknown> | undefined {
    const name = injectionTokenName(APP_INITIALIZER);
    if (!$injector.has(name)) return undefined;
    const initializers = $injector.get<readonly (() => void | PromiseLike<unknown>)[]>(name);
    return Promise.all(initializers.map((initializer) => initializer()));
  }
}

AppInitializers.add(($injector) => AppInitializers.fromToken($injector));

/** Como `provideAppInitializer()` de Angular: una función que corre al arrancar (puede devolver una promesa). */
export function provideAppInitializer(fn: AppInitializer): void {
  AppInitializers.add(fn);
}
