import { inject } from "@/core/di/inject.ts";
import { Injectable } from "@/core/di/injectable.ts";
import type { AbstractControl } from "@/forms/abstract-control.ts";
import { FormArray } from "@/forms/form-array.ts";
import { FormControl, type FormControlState } from "@/forms/form-control.ts";
import { FormGroup, type FormGroupControls } from "@/forms/form-group.ts";
import { FormRecord } from "@/forms/form-record.ts";
import type { AbstractControlOptions, AsyncValidatorFn, FormControlOptions, ValidatorFn } from "@/forms/types.ts";

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
@Injectable({ providedIn: "root" })
export class FormBuilder {
  /** Crea todos sus `FormControl` con `nonNullable` (ver `nonNullable`). */
  protected readonly useNonNullable: boolean = false;

  /** El mismo builder, pero todos los `FormControl` que crea son `nonNullable` (`reset()` vuelve al valor inicial). */
  get nonNullable(): NonNullableFormBuilder {
    return new NonNullableFormBuilderImpl() as NonNullableFormBuilder;
  }

  control<TValue = unknown>(
    formState: TValue | FormControlState<TValue>,
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormControl<TValue> {
    return new FormControl<TValue>(formState, this.withNonNullable(validatorsOrOpts), asyncValidators);
  }

  record<TControl extends AbstractControl = AbstractControl>(
    controlsConfig: Record<string, ControlConfig>,
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ): FormRecord<TControl> {
    const controls: Record<string, TControl> = {};
    for (const [name, config] of Object.entries(controlsConfig)) controls[name] = this._createControl(config) as TControl;
    return new FormRecord<TControl>(controls, validatorsOrOpts, asyncValidators);
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
    if (isControlConfigTuple(config)) return new FormControl(config[0], this.withNonNullable(config[1] ?? null), config[2] ?? null);
    return new FormControl(config, this.withNonNullable(null));
  }

  /** Las opciones de un `FormControl`, con `nonNullable` si este builder lo pide. */
  private withNonNullable(
    validatorsOrOpts: ValidatorFn | ValidatorFn[] | FormControlOptions | null | undefined,
  ): ValidatorFn | ValidatorFn[] | FormControlOptions | null | undefined {
    if (!this.useNonNullable) return validatorsOrOpts;
    if (validatorsOrOpts && typeof validatorsOrOpts === "object" && !Array.isArray(validatorsOrOpts)) {
      return { ...validatorsOrOpts, nonNullable: true };
    }
    return { validators: validatorsOrOpts ?? null, nonNullable: true };
  }
}

class NonNullableFormBuilderImpl extends FormBuilder {
  protected override readonly useNonNullable = true;
}

/**
 * `NonNullableFormBuilder` de Angular 14+: inyectable, es el `nonNullable` del `FormBuilder` de la app — todos sus
 * `FormControl` vuelven al valor inicial con `reset()`.
 */
@Injectable({ providedIn: "root", useFactory: () => inject(FormBuilder).nonNullable })
export abstract class NonNullableFormBuilder extends FormBuilder {}
