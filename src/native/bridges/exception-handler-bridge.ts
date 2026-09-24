import type angular from "angular";
import { injectionTokenName } from "@/core/di/injector.ts";
import { ErrorHandler } from "@/core/platform/error-handler.ts";

/**
 * `$exceptionHandler` de AngularJS → `ErrorHandler` de la app (el que provea, o el de la raíz): todo error que
 * AngularJS atrapa (digest, listeners, promesas de `$q`) pasa por el mismo embudo que en Angular. Se resuelve al
 * primer error, no al registrar: `$exceptionHandler` lo pide `$rootScope`, y pedir `ErrorHandler` ahí formaría un
 * ciclo si su implementación inyecta algo que depende de `$rootScope`.
 */
export function decorateExceptionHandler(
  $delegate: angular.IExceptionHandlerService,
  $injector: angular.auto.IInjectorService,
): angular.IExceptionHandlerService {
  let handler: ErrorHandler | undefined;
  return (exception: Error, cause?: string) => {
    const name = injectionTokenName(ErrorHandler);
    if (!handler && !$injector.has(name)) return $delegate(exception, cause);
    handler ??= $injector.get<ErrorHandler>(name);
    handler.handleError(exception);
  };
}
decorateExceptionHandler.$inject = ["$delegate", "$injector"];
