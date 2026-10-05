import type angular from "angular";

type BootstrapListener = ($injector: angular.auto.IInjectorService) => void;

/**
 * Lo que en Angular cuelga de `APP_BOOTSTRAP_LISTENER`, de uso interno: funciones que corren cuando una app terminó de
 * arrancar — initializers resueltos y host compilado — y antes de que `bootstrapModule()` resuelva. Lo usa el router
 * para su navegación inicial. La lista es de la página, no de una app: cada función recibe el `$injector` de la app que
 * arrancó y decide si le toca.
 */
export class BootstrapListeners {
  private static readonly listeners = new Set<BootstrapListener>();

  static add(listener: BootstrapListener): void {
    BootstrapListeners.listeners.add(listener);
  }

  static run($injector: angular.auto.IInjectorService): void {
    for (const listener of BootstrapListeners.listeners) listener($injector);
  }
}
