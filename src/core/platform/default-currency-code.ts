import { InjectionToken } from "@/core/di/injection-token.ts";

/** Mismo token que `@angular/core`: la moneda de `CurrencyPipe` cuando no se pasa un código (`"USD"` por defecto). */
export const DEFAULT_CURRENCY_CODE = new InjectionToken<string>("DEFAULT_CURRENCY_CODE", {
  factory: () => "USD",
});
