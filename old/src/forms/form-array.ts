import { AbstractControl } from "@/forms/abstract-control.ts";
import type { AbstractControlOptions, AsyncValidatorFn, ControlEventOptions, ValidatorFn } from "@/forms/types.ts";

function isOptionsObject(value: unknown): value is AbstractControlOptions {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function computeArrayValue<TControl extends AbstractControl>(controls: readonly TControl[]): Array<TControl["value"]> {
  return controls.filter((control) => control.enabled).map((control) => control.value);
}

/**
 * Lista de controles del árbol reactivo — el `FormArray` shim de
 * `@angular/forms`. Misma brecha que `FormGroup` (sin equivalente nativo en
 * AngularJS): `formArrayName` (siguiente pieza de esta etapa) es quien ata
 * cada entrada a inputs reales del DOM.
 */
export class FormArray<TControl extends AbstractControl = AbstractControl> extends AbstractControl<
  Array<TControl["value"]>
> {
  private _controls: TControl[];

  constructor(
    controls: TControl[],
    validatorsOrOpts?: ValidatorFn | ValidatorFn[] | AbstractControlOptions | null,
    asyncValidators?: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    if (isOptionsObject(validatorsOrOpts)) {
      super(computeArrayValue(controls), validatorsOrOpts.validators ?? null, validatorsOrOpts.asyncValidators ?? null);
    } else {
      super(computeArrayValue(controls), validatorsOrOpts ?? null, asyncValidators ?? null);
    }
    this._controls = controls;
    for (const control of controls) control.setParent(this);
    this.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  get controls(): TControl[] {
    return this._controls;
  }

  get length(): number {
    return this._controls.length;
  }

  at(index: number): TControl {
    return this._controls[index];
  }

  push(control: TControl, opts: ControlEventOptions = {}): void {
    this._controls.push(control);
    control.setParent(this);
    this.updateValueAndValidity(opts);
  }

  insert(index: number, control: TControl, opts: ControlEventOptions = {}): void {
    this._controls.splice(index, 0, control);
    control.setParent(this);
    this.updateValueAndValidity(opts);
  }

  removeAt(index: number, opts: ControlEventOptions = {}): void {
    this._controls.splice(index, 1);
    this.updateValueAndValidity(opts);
  }

  setControl(index: number, control: TControl, opts: ControlEventOptions = {}): void {
    this._controls.splice(index, 1, control);
    control.setParent(this);
    this.updateValueAndValidity(opts);
  }

  clear(opts: ControlEventOptions = {}): void {
    this._controls.splice(0, this._controls.length);
    this.updateValueAndValidity(opts);
  }

  setValue(value: Array<TControl["value"]>, opts: ControlEventOptions = {}): void {
    if (value.length !== this._controls.length) {
      throw new Error(
        `FormArray.setValue() requiere un array de longitud ${this._controls.length}, recibió ${value.length}`,
      );
    }
    value.forEach((entry, index) => {
      this._controls[index].setValue(entry, { onlySelf: true, emitEvent: opts.emitEvent });
    });
    this.updateValueAndValidity(opts);
  }

  patchValue(value: Array<TControl["value"]>, opts: ControlEventOptions = {}): void {
    value.forEach((entry, index) => {
      this._controls[index]?.patchValue(entry, { onlySelf: true, emitEvent: opts.emitEvent });
    });
    this.updateValueAndValidity(opts);
  }

  reset(value: Array<TControl["value"]> = [], opts: ControlEventOptions = {}): void {
    this._controls.forEach((control, index) => {
      control.reset(value[index], { onlySelf: true, emitEvent: opts.emitEvent });
    });
    this.updateValueAndValidity(opts);
  }

  getRawValue(): Array<TControl["value"]> {
    return this._controls.map((control) => control.getRawValue());
  }

  protected _updateValue(): void {
    this._value = computeArrayValue(this._controls);
  }

  protected _forEachChild(callback: (control: AbstractControl) => void): void {
    for (const control of this._controls) callback(control);
  }

  protected _find(segment: string | number): AbstractControl | null {
    const index = typeof segment === "number" ? segment : Number(segment);
    return this._controls[index] ?? null;
  }
}
