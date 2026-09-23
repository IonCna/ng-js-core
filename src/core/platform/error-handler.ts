/**
 * Embudo único y reemplazable para los errores de la app. El runtime puede
 * conectarlo a `$exceptionHandler` de AngularJS; los errores async ya no pasan
 * por un objeto `NgZone` porque el compiler usa su propio polyfill.
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
