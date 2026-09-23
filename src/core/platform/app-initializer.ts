const APP_INITIALIZERS_GLOBAL = "ɵngjsAppInitializers";

type AppInitializer = (injector: unknown) => void | Promise<unknown>;

/** Registrar antes del bootstrap. Lista global (v1 = una app). */
export function provideAppInitializer(fn: AppInitializer): void {
    const globals = globalThis as typeof globalThis & Record<string, unknown>;
    const initializers = (globals[APP_INITIALIZERS_GLOBAL] as AppInitializer[] | undefined) ?? [];
    initializers.push(fn);
    globals[APP_INITIALIZERS_GLOBAL] = initializers;
}
