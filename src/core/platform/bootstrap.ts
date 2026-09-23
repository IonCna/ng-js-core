import type angular from "angular";

/** Opciones conservadas para compatibilidad de tipos; el compiler las resuelve en build. */
export interface BootstrapOptions {
    modules?: string[];
    hostElement?: string | Element;
    rootComponentTags?: string[];
}

/** Fachada pública sobre la plataforma generada por `ng-js-compiler`. */
export abstract class PlatformRef {
    abstract bootstrapModule(moduleType: unknown, options?: BootstrapOptions): Promise<angular.auto.IInjectorService>;
    abstract onDestroy(callback: () => void): void;
    abstract destroy(): void;
    abstract readonly destroyed: boolean;
}

export class PlatformRefImpl extends PlatformRef {
    private _destroyed = false;
    private readonly _destroyListeners = new Set<() => void>();

    bootstrapModule(moduleType: unknown, _options?: BootstrapOptions): Promise<angular.auto.IInjectorService> {
        if (this._destroyed) return Promise.reject(new Error("PlatformRef ya fue destruido"));

        const platform = (globalThis as Record<string, unknown>).ɵngjsPlatform;
        if (!platform || typeof platform !== "object" || !("bootstrapModule" in platform)) {
            return Promise.reject(new Error("La plataforma del compiler no está disponible. Usa una aplicación compilada con ng-js-cli."));
        }

        return (platform as { bootstrapModule: (module: unknown) => Promise<angular.auto.IInjectorService> }).bootstrapModule(moduleType);
    }

    onDestroy(callback: () => void): void {
        if (this._destroyed) return;
        this._destroyListeners.add(callback);
    }

    get destroyed(): boolean {
        return this._destroyed;
    }

    destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;

        for (const callback of this._destroyListeners) callback();
        this._destroyListeners.clear();
    }
}

let platform: PlatformRef | undefined;

/** Equivalente de `platformBrowserDynamic()` para la plataforma del compiler. */
export function platformBrowserDynamic(): PlatformRef {
    platform ??= new PlatformRefImpl();
    return platform;
}

/** Alias compatible con el nombre usado por algunas aplicaciones. */
export const platformBrowser = platformBrowserDynamic;

export interface ApplicationConfig {
    modules?: string[];
    hostElement?: string | Element;
    providers?: unknown[];
}
