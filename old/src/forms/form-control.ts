import { AbstractControl } from "@/forms/abstract-control.ts";
import type { AbstractControlOptions, AsyncValidatorFn, ControlEventOptions, ValidatorFn } from "@/forms/types.ts";

export interface FormControlState<TValue> {
  value: TValue;
  disabled: boolean;
}

function isBoxedState<TValue>(formState: TValue | FormControlState<TValue>): formState is FormControlState<TValue> {
  return (
    typeof formState === "object" &&
    formState !== null &&
    "value" in formState &&
    "disabled" in formState &&
    typeof (formState as { disabled: unknown }).disabled === "boolean"
  );
}

function isOptionsObject(value: unknown): value is AbstractControlOptions {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Control individual del árbol reactivo. Sin dependencia de AngularJS: la
 * conexión con el `NgModelController` real de un input la hace
 * `control-value-accessor-bridge.ts` (siguiente pieza de esta etapa) — acá
 * es el mismo shim de valor/estado que `FormControl` de `@angular/forms`.
 */
export class FormControl<TValue = unknown> extends AbstractControl<TValue> {
  constructor(
    formState: TValue | FormControlState<TValue> = null as TValue,
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    const { value, disabled } = isBoxedState(formState) ? formState : { value: formState, disabled: false };

    if (isOptionsObject(validatorsOrOpts)) {
      super(value, validatorsOrOpts.validators ?? null, validatorsOrOpts.asyncValidators ?? null);
    } else {
      super(value, validatorsOrOpts ?? null, asyncValidators ?? null);
    }

    if (disabled) this.disable({ onlySelf: true, emitEvent: false });
    this.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  setValue(value: TValue, opts: ControlEventOptions = {}): void {
    this._value = value;
    this.updateValueAndValidity(opts);
  }

  patchValue(value: TValue, opts: ControlEventOptions = {}): void {
    this.setValue(value, opts);
  }

  reset(formState: TValue | FormControlState<TValue> = null as TValue, opts: ControlEventOptions = {}): void {
    const { value, disabled } = isBoxedState(formState) ? formState : { value: formState, disabled: false };
    this.markAsPristine(opts);
    this.markAsUntouched(opts);
    this.setValue(value, opts);
    disabled ? this.disable({ ...opts, onlySelf: true }) : this.enable({ ...opts, onlySelf: true });
  }

  getRawValue(): TValue {
    return this.value;
  }
}
