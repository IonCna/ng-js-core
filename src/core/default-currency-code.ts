import { InjectionToken } from "@/core/di/injection-token.ts";

/** `DEFAULT_CURRENCY_CODE` — mismo token que `@angular/core`: la moneda de `CurrencyPipe` cuando no se pasa código. */
export const DEFAULT_CURRENCY_CODE = new InjectionToken<string>("DEFAULT_CURRENCY_CODE", {
  factory: () => "USD",
});
