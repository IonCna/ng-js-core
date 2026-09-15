import { AbstractControl } from "@/forms/abstract-control.ts";
import type { AbstractControlOptions, AsyncValidatorFn, ControlEventOptions, ValidatorFn } from "@/forms/types.ts";

export type FormGroupControls = Record<string, AbstractControl>;

type GroupValue<TControls extends FormGroupControls> = { [K in keyof TControls]: TControls[K]["value"] };

function isOptionsObject(value: unknown): value is AbstractControlOptions {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function computeGroupValue<TControls extends FormGroupControls>(controls: TControls): GroupValue<TControls> {
  const value = {} as GroupValue<TControls>;
  for (const key of Object.keys(controls)) {
    const control = controls[key];
    if (control.enabled) value[key as keyof TControls] = control.value as GroupValue<TControls>[keyof TControls];
  }
  return value;
}

/**
 * Árbol de controles con nombre — el `FormGroup` shim de `@angular/forms`.
 * Sin dependencia de AngularJS ("brecha", `ReactiveFormsModule` no existe
 * ahí): las directivas `[formGroup]`/`formControlName` (siguiente pieza de
 * esta etapa) son las que atan cada `FormControl` de este árbol al
 * `NgModelController` real de un input.
 */
export class FormGroup<TControls extends FormGroupControls = FormGroupControls> extends AbstractControl<
  GroupValue<TControls>
> {
  private _controls: TControls;

  constructor(
    controls: TControls,
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    if (isOptionsObject(validatorsOrOpts)) {
      super(computeGroupValue(controls), validatorsOrOpts.validators ?? null, validatorsOrOpts.asyncValidators ?? null);
    } else {
      super(computeGroupValue(controls), validatorsOrOpts ?? null, asyncValidators ?? null);
    }
    this._controls = controls;
    for (const control of Object.values(controls)) control.setParent(this);
    this.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  get controls(): TControls {
    return this._controls;
  }

  addControl<K extends string>(name: K, control: AbstractControl, opts: ControlEventOptions = {}): void {
    (this._controls as FormGroupControls)[name] = control;
    control.setParent(this);
    this.updateValueAndValidity(opts);
  }

  removeControl(name: string, opts: ControlEventOptions = {}): void {
    delete (this._controls as FormGroupControls)[name];
    this.updateValueAndValidity(opts);
  }

  setControl(name: string, control: AbstractControl, opts: ControlEventOptions = {}): void {
    delete (this._controls as FormGroupControls)[name];
    (this._controls as FormGroupControls)[name] = control;
    control.setParent(this);
    this.updateValueAndValidity(opts);
  }

  contains(name: string): boolean {
    const control = (this._controls as FormGroupControls)[name];
    return !!control?.enabled;
  }

  setValue(value: GroupValue<TControls>, opts: ControlEventOptions = {}): void {
    for (const name of Object.keys(this._controls)) {
      if (!Object.hasOwn(value as object, name)) {
        throw new Error(
          `FormGroup.setValue() requiere todas las claves de 'controls' — falta '${name}' (usar patchValue() para un valor parcial)`,
        );
      }
      (this._controls as FormGroupControls)[name].setValue((value as Record<string, unknown>)[name], {
        onlySelf: true,
        emitEvent: opts.emitEvent,
      });
    }
    this.updateValueAndValidity(opts);
  }

  patchValue(value: Partial<GroupValue<TControls>>, opts: ControlEventOptions = {}): void {
    for (const name of Object.keys(value as object)) {
      const control = (this._controls as FormGroupControls)[name];
      control?.patchValue((value as Record<string, unknown>)[name], { onlySelf: true, emitEvent: opts.emitEvent });
    }
    this.updateValueAndValidity(opts);
  }

  reset(value: Partial<GroupValue<TControls>> = {}, opts: ControlEventOptions = {}): void {
    for (const name of Object.keys(this._controls)) {
      (this._controls as FormGroupControls)[name].reset((value as Record<string, unknown>)[name], {
        onlySelf: true,
        emitEvent: opts.emitEvent,
      });
    }
    this.updateValueAndValidity(opts);
  }

  getRawValue(): GroupValue<TControls> {
    const raw = {} as GroupValue<TControls>;
    for (const name of Object.keys(this._controls)) {
      raw[name as keyof TControls] = (this._controls as FormGroupControls)[
        name
      ].getRawValue() as GroupValue<TControls>[keyof TControls];
    }
    return raw;
  }

  protected _updateValue(): void {
    this._value = computeGroupValue(this._controls);
  }

  protected _forEachChild(callback: (control: AbstractControl) => void): void {
    for (const control of Object.values(this._controls)) callback(control);
  }

  protected _find(segment: string | number): AbstractControl | null {
    return (this._controls as FormGroupControls)[String(segment)] ?? null;
  }
}
