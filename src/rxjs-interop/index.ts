// `DestroyRef` vive en `ngjs-core` (raíz) / `ngjs-core/core` — `@angular/core/rxjs-interop`
// tampoco lo re-exporta. Ver `src/core/refs/index.ts`.
export { outputFromObservable, outputToObservable } from "./output-interop.ts";
export { takeUntilDestroyed } from "./take-until-destroyed.ts";
