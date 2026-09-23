import { forkJoin, from, isObservable, type Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { AbstractControl } from "@/forms/abstract-control.ts";
import type { AsyncValidatorFn, ValidationErrors, ValidatorFn } from "@/forms/types.ts";

// Mismo regex que usa @angular/forms (HTML5 email pattern, no RFC completo a propósito).
const EMAIL_REGEXP =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function isEmptyInputValue(value: unknown): boolean {
  // "" / [] cuentan como vacío (mismo criterio que @angular/forms), 0 y false no.
  return value === null || value === undefined || (hasLength(value) && value.length === 0);
}

function hasLength(value: unknown): value is { length: number } {
  return typeof value === "string" || Array.isArray(value);
}

function toObservable(
  value: Observable<ValidationErrors | null> | Promise<ValidationErrors | null>,
): Observable<ValidationErrors | null> {
  return isObservable(value) ? value : from(value);
}

function mergeErrors(errorsList: readonly (ValidationErrors | null)[]): ValidationErrors | null {
  let merged: ValidationErrors = {};
  let hasErrors = false;
  for (const errors of errorsList) {
    if (errors != null) {
      hasErrors = true;
      merged = { ...merged, ...errors };
    }
  }
  return hasErrors ? merged : null;
}

/**
 * Firma idéntica a `Validators` de `@angular/forms` — reutilizable en
 * Angular real sin cambios ("shim", ver `CONCEPTOS.md`). Cada validador
 * ignora un valor "vacío" (`null`, `undefined`, `""`, `[]`) salvo
 * `required`/`requiredTrue`, que son justamente los que lo chequean — mismo
 * criterio que Angular real, así `Validators.min(0)` no pisa a `required` en
 * un control opcional.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: a propósito — `Validators.required`/`Validators.min(n)` tiene que llamarse igual que en @angular/forms
export class Validators {
  static required(control: AbstractControl): ValidationErrors | null {
    return isEmptyInputValue(control.value) ? { required: true } : null;
  }

  static requiredTrue(control: AbstractControl): ValidationErrors | null {
    return control.value === true ? null : { required: true };
  }

  static email(control: AbstractControl): ValidationErrors | null {
    if (isEmptyInputValue(control.value)) return null;
    return EMAIL_REGEXP.test(String(control.value)) ? null : { email: true };
  }

  static min(min: number): ValidatorFn {
    return (control) => {
      if (isEmptyInputValue(control.value) || isEmptyInputValue(min)) return null;
      const value = Number(control.value);
      return !Number.isNaN(value) && value < min ? { min: { min, actual: control.value } } : null;
    };
  }

  static max(max: number): ValidatorFn {
    return (control) => {
      if (isEmptyInputValue(control.value) || isEmptyInputValue(max)) return null;
      const value = Number(control.value);
      return !Number.isNaN(value) && value > max ? { max: { max, actual: control.value } } : null;
    };
  }

  static minLength(minLength: number): ValidatorFn {
    return (control) => {
      if (isEmptyInputValue(control.value) || !hasLength(control.value)) return null;
      return control.value.length < minLength
        ? { minlength: { requiredLength: minLength, actualLength: control.value.length } }
        : null;
    };
  }

  static maxLength(maxLength: number): ValidatorFn {
    return (control) => {
      if (!hasLength(control.value)) return null;
      return control.value.length > maxLength
        ? { maxlength: { requiredLength: maxLength, actualLength: control.value.length } }
        : null;
    };
  }

  static pattern(pattern: string | RegExp): ValidatorFn {
    if (!pattern) return Validators.nullValidator;
    const regex =
      typeof pattern === "string" ? new RegExp(pattern.startsWith("^") ? pattern : `^${pattern}$`) : pattern;
    return (control) => {
      if (isEmptyInputValue(control.value)) return null;
      const value = String(control.value);
      return regex.test(value) ? null : { pattern: { requiredPattern: regex.toString(), actualValue: value } };
    };
  }

  static nullValidator(): ValidationErrors | null {
    return null;
  }

  static compose(validators: (ValidatorFn | null | undefined)[] | null): ValidatorFn | null {
    const present = (validators ?? []).filter((validator): validator is ValidatorFn => validator != null);
    if (present.length === 0) return null;
    return (control) => {
      let merged: ValidationErrors = {};
      let hasErrors = false;
      for (const validator of present) {
        const errors = validator(control);
        if (errors) {
          hasErrors = true;
          merged = { ...merged, ...errors };
        }
      }
      return hasErrors ? merged : null;
    };
  }

  static composeAsync(validators: (AsyncValidatorFn | null | undefined)[] | null): AsyncValidatorFn | null {
    const present = (validators ?? []).filter((validator): validator is AsyncValidatorFn => validator != null);
    if (present.length === 0) return null;
    // FormControl/Group/Array ya componen su propio array de asyncValidators
    // solas (misma lógica, en abstract-control.ts); este método es azúcar
    // para quien quiera el validador combinado suelto, fuera de un control.
    return (control) => forkJoin(present.map((validator) => toObservable(validator(control)))).pipe(map(mergeErrors));
  }
}
