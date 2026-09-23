import type angular from "angular";

/**
 * Corre antes de que la app arranque. Si devuelve `Promise`, `bootstrapModule`
 * espera a que resuelva. Recibe el `$injector` para pedir servicios.
 *
 * Sustrato v1 del `APP_INITIALIZER` de Angular: misma semántica (juntar fns,
 * correr + esperar antes de dar la app por lista). Etapa 3 lo re-implementa
 * encima de `{ provide: APP_INITIALIZER, multi: true }` sin cambiar esta firma.
 */
export type AppInitializerFn = ($injector: angular.auto.IInjectorService) => void | Promise<unknown>;

const initializers: AppInitializerFn[] = [];

/** Registrar antes del bootstrap. Lista global (v1 = una app). */
export function provideAppInitializer(fn: AppInitializerFn): void {
    initializers.push(fn);
}

/**
 * Corre todos los initializers registrados en paralelo y espera a que terminen.
 * Lo llama `PlatformRef.bootstrapModule` después de `angular.bootstrap` y antes
 * de resolver el `ApplicationRef`. Vacía la lista (re-bootstrap = re-registrar).
 */
export async function runAppInitializers($injector: angular.auto.IInjectorService): Promise<void> {
    const batch = initializers.splice(0);
    const pending: Promise<unknown>[] = [];

    for (const init of batch) {
        const result = init($injector);
        if (isThenable(result)) pending.push(Promise.resolve(result));
    }

    await Promise.all(pending);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
    return value != null && typeof (value as { then?: unknown }).then === "function";
}
