import angular from "angular";
import { injectionTokenName } from "@/core/di/injector.ts";
import { ApplicationRef } from "@/core/platform/application-ref.ts";
import { ComponentRegistrar } from "@/core/platform/component-registrar.ts";
import { NativeModule } from "@/native/native.module.ts";

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
  /** Las apps que arrancó: `destroy()` las destruye (su `ApplicationRef`), como Angular. */
  private readonly injectors = new Set<angular.auto.IInjectorService>();

  bootstrapModule(moduleType: unknown, _options?: BootstrapOptions): Promise<angular.auto.IInjectorService> {
    if (this._destroyed) return Promise.reject(new Error("PlatformRef ya fue destruido"));

    const platform = (globalThis as Record<string, unknown>).ɵngjsPlatform;
    if (!platform || typeof platform !== "object" || !("bootstrapModule" in platform)) {
      return Promise.reject(
        new Error("La plataforma del compiler no está disponible. Usa una aplicación compilada con ng-js-cli."),
      );
    }

    try {
      PlatformRefImpl.prepareRootModule(moduleType);
    } catch (error) {
      return Promise.reject(error);
    }
    return (platform as { bootstrapModule: (module: unknown) => Promise<angular.auto.IInjectorService> })
      .bootstrapModule(moduleType)
      .then(($injector) => {
        this.injectors.add($injector);
        return $injector;
      });
  }

  /**
   * Los bridges de `ngjs-core` (`ElementRef`, queries, `hostDirectives`, …) viven en un `angular.module` propio
   * (`NativeModule`). Como la plataforma de Angular, arrancar con `platformBrowserDynamic()` los trae solos: se
   * agregan a los `requires` del módulo raíz antes de `angular.bootstrap` (que recién ahí resuelve los requires).
   * El `controllerAs` del módulo raíz queda como constante de la app: lo usan los componentes que se registran al
   * vuelo fuera de todo `@NgModule` (`loadComponent`), ver `ComponentRegistrar`.
   */
  private static prepareRootModule(moduleType: unknown): void {
    const mod = (moduleType as { ɵmod?: { id?: string; controllerAs?: string } } | undefined)?.ɵmod;
    if (!mod?.id) return; // la plataforma del compiler da el error de "no es un @NgModule compilado"
    const module = angular.module(mod.id);
    if (!module.requires.includes(NativeModule.name)) module.requires.unshift(NativeModule.name);
    if (mod.controllerAs !== undefined) module.constant(ComponentRegistrar.ROOT_CONTROLLER_AS, mod.controllerAs);
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

    for (const $injector of this.injectors) $injector.get<ApplicationRef>(injectionTokenName(ApplicationRef)).destroy();
    this.injectors.clear();
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

/**
 * Atajo de `platformBrowserDynamic().bootstrapModule(AppModule)` que resuelve con el `ApplicationRef` de la app (la
 * API del modo runtime anterior de `ngjs-core`). A diferencia del `bootstrapApplication` de Angular (componente
 * standalone), recibe el `@NgModule` raíz compilado.
 */
export function bootstrapApplication(moduleType: unknown): Promise<ApplicationRef> {
  return platformBrowserDynamic()
    .bootstrapModule(moduleType)
    .then(($injector) => $injector.get<ApplicationRef>(injectionTokenName(ApplicationRef)));
}

export interface ApplicationConfig {
  modules?: string[];
  hostElement?: string | Element;
  providers?: unknown[];
}
