import type { AsyncValidatorFn, ValidatorFn } from "@/forms/types.ts";

/**
 * Mismo contrato que `@angular/forms`: una directiva que valida el control
 * al que está aplicada. `validate` tiene la misma firma que `ValidatorFn`
 * (`src/forms/types.ts`) — reutilizable en Angular real sin cambios.
 *
 * `registerOnValidatorChange` queda sin cablear por ahora (brecha
 * documentada, ver `ng-validators-bridge.ts`): en Angular avisa que cambió
 * *el criterio* del validador (p.ej. `[minlength]` cambió de valor) sin que
 * cambie el valor del control. Acá `ngModel.$validators` ya se re-evalúa
 * solo en cada cambio de valor — falta el caso de "cambió el input del
 * validador, no el del control".
 */
export interface Validator {
  validate: ValidatorFn;
  registerOnValidatorChange?(fn: () => void): void;
}

/** Async: misma firma que `AsyncValidatorFn`. Mismas brechas que `Validator`. */
export interface AsyncValidator {
  validate: AsyncValidatorFn;
  registerOnValidatorChange?(fn: () => void): void;
}
