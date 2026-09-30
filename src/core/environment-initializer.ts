import { InjectionToken } from "@/core/di/injection-token.ts";

/** Como `@angular/core`: funciones `multi` que corren al arrancar, antes que `APP_INITIALIZER` (`app-initializer.ts`). */
export const ENVIRONMENT_INITIALIZER = new InjectionToken<readonly (() => void)[]>("ENVIRONMENT_INITIALIZER");
