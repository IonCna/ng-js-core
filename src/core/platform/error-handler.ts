import { forwardRef } from "@/core/di/forward-ref.ts";
import { Injectable } from "@/core/di/injectable.ts";

/**
 * Embudo único y reemplazable para los errores de la app: `ngjs-core` le pasa lo que llega a `$exceptionHandler`
 * de AngularJS (ver `NativeModule`). Se provee solo en la raíz; `{ provide: ErrorHandler, useClass: Propio }` en un
 * `@NgModule` lo reemplaza, como en Angular.
 */
@Injectable({ providedIn: "root", useClass: forwardRef(() => ErrorHandlerImpl) })
export abstract class ErrorHandler {
  abstract handleError(error: unknown): void;
}

export class ErrorHandlerImpl extends ErrorHandler {
  handleError(error: unknown): void {
    console.error(error);
  }
}
