import type { Observable } from "rxjs";
import type { AbstractControl } from "@/forms/abstract-control.ts";

/** Misma forma que `@angular/forms`: `{ claveDeError: detalle }`, `null` = sin errores. */
export type ValidationErrors = Record<string, unknown>;

export type FormControlStatus = "VALID" | "INVALID" | "PENDING" | "DISABLED";

/** Firma idéntica a `@angular/forms` — reutilizable en Angular real sin cambios de código. */
export type ValidatorFn = (control: AbstractControl) => ValidationErrors | null;

export type AsyncValidatorFn = (
  control: AbstractControl,
) => Observable<ValidationErrors | null> | Promise<ValidationErrors | null>;

export interface AbstractControlOptions {
  validators?: ValidatorFn | ValidatorFn[] | null;
  asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null;
  /**
   * Reservado para cuando se cablee `[formControlName]`/`[formGroup]` contra
   * `NgModelController` (etapa 15, directivas) — ahí se traduce a
   * `ngModelOptions="{ updateOn: ... }"`, que ya existe nativo en AngularJS.
   * Guardado acá solo para no romper la forma de las opciones.
   */
  updateOn?: "change" | "blur" | "submit";
}

export interface ControlEventOptions {
  /** No propagar el efecto (validez, touched, pristine…) hacia el `parent`. */
  onlySelf?: boolean;
  /** `false` suprime la emisión en `valueChanges`/`statusChanges` de este control. */
  emitEvent?: boolean;
}
