import type { AbstractControl } from "@/forms/abstract-control.ts";
import { FormArray } from "@/forms/form-array.ts";
import { FormControl, type FormControlState } from "@/forms/form-control.ts";
import { FormGroup, type FormGroupControls } from "@/forms/form-group.ts";
import type { AbstractControlOptions, AsyncValidatorFn, ValidatorFn } from "@/forms/types.ts";

/** Forma corta de `FormBuilder.group()`: `[valor, validators?, asyncValidators?]`, igual que `@angular/forms`. */
type ControlConfigTuple = [unknown, (ValidatorFn | ValidatorFn[])?, (AsyncValidatorFn | AsyncValidatorFn[])?];

type ControlConfig = AbstractControl | ControlConfigTuple | unknown;

function isAbstractControl(value: unknown): value is AbstractControl {
  return value instanceof FormControl || value instanceof FormGroup || value instanceof FormArray;
}

function isControlConfigTuple(value: unknown): value is ControlConfigTuple {
  return Array.isArray(value) && value.length > 0 && value.length <= 3 && !isAbstractControl(value[0]);
}

/**
 * Factory fina sobre `FormControl`/`FormGroup`/`FormArray` — el `FormBuilder`
 * shim de `@angular/forms`. Misma forma de "control config" (valor pelado,
 * tupla `[valor, validators, asyncValidators]`, o un `AbstractControl` ya
 * armado) para que `.group({...})` migre directo.
 */
export class FormBuilder {
  control<TValue = unknown>(
    formState: TValue | FormControlState<TValue>,
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormControl<TValue> {
    return new FormControl<TValue>(formState, validatorsOrOpts, asyncValidators);
  }

  group<TControls extends FormGroupControls = FormGroupControls>(
    controlsConfig: Record<string, ControlConfig>,
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormGroup<TControls> {
    const controls = {} as FormGroupControls;
    for (const [name, config] of Object.entries(controlsConfig)) {
      controls[name] = this._createControl(config);
    }
    return new FormGroup(controls, validatorsOrOpts, asyncValidators) as unknown as FormGroup<TControls>;
  }

  array<TControl extends AbstractControl = AbstractControl>(
    controlsConfig: ControlConfig[],
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormArray<TControl> {
    const controls = controlsConfig.map((config) => this._createControl(config)) as TControl[];
    return new FormArray<TControl>(controls, validatorsOrOpts, asyncValidators);
  }

  private _createControl(config: ControlConfig): AbstractControl {
    if (isAbstractControl(config)) return config;
    if (isControlConfigTuple(config)) return new FormControl(config[0], config[1] ?? null, config[2] ?? null);
    return new FormControl(config);
  }
}
