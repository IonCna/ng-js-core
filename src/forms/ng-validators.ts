import { InjectionToken } from "@/core/di/injection-token.ts";
import type { AsyncValidator, Validator } from "@/forms/validator.ts";

/**
 * Mismos tokens que `@angular/forms`. Una directiva de validación los provee
 * sobre su propio elemento (`providers: [{ provide: NG_VALIDATORS, useExisting:
 * forwardRef(() => Self), multi: true }]`) para declararse como validador de
 * ese control — mismo mecanismo de opt-in que `NG_VALUE_ACCESSOR`
 * (`ng-value-accessor.ts`).
 *
 * Sin `factory`: no son singletons de app — `ng-validators-bridge.ts` los usa
 * solo como señal (lee `providers` de la metadata de la clase, no resuelve
 * por el `ElementInjectorNode`).
 */
export const NG_VALIDATORS = new InjectionToken<readonly Validator[]>("NG_VALIDATORS");

export const NG_ASYNC_VALIDATORS = new InjectionToken<readonly AsyncValidator[]>("NG_ASYNC_VALIDATORS");
