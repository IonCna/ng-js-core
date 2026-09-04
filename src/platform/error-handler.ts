/**
 * Embudo único y reemplazable para los errores de la app. Le llegan por dos vías
 * independientes, cableadas en `NgCoreModule`:
 *  - suscripción a `ngZone.onError` — errores async escapados de una task del zone
 *  - `.decorator("$exceptionHandler")` — errores síncronos que atrapa AngularJS
 *    (digest, link de directivas, `ng-click`)
 */
export abstract class ErrorHandler {
    static readonly $name = "ErrorHandler";

    abstract handleError(error: unknown): void;
}

export class ErrorHandlerImpl extends ErrorHandler {
    static readonly $inject = [] as const;

    handleError(error: unknown): void {
        console.error(error);
    }
}
