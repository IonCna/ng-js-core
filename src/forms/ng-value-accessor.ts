import { InjectionToken } from "@/core/di/injection-token.ts";
import type { ControlValueAccessor } from "@/forms/control-value-accessor.ts";

/**
 * Mismo token que `@angular/forms`. Una directiva lo provee sobre su propio
 * elemento (`providers: [{ provide: NG_VALUE_ACCESSOR, useExisting:
 * forwardRef(() => Self), multi: true }]`) para declararse como el
 * `ControlValueAccessor` de ese control.
 *
 * Sin `factory`: no es un singleton de app — se resuelve por el
 * `ElementInjectorNode` del elemento (que ya soporta `multi` + `useExisting`).
 * `control-value-accessor-bridge.ts` lo usa como señal de opt-in.
 */
export const NG_VALUE_ACCESSOR = new InjectionToken<readonly ControlValueAccessor[]>("NG_VALUE_ACCESSOR");
