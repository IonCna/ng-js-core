import { BehaviorSubject, forkJoin, from, isObservable, type Observable, type Subscription } from "rxjs";
import { map } from "rxjs/operators";
import type {
  AsyncValidatorFn,
  ControlEventOptions,
  FormControlStatus,
  ValidationErrors,
  ValidatorFn,
} from "@/forms/types.ts";

function coerceToArray<T>(value: T | T[] | null | undefined): T[] | null {
  if (!value) return null;
  return Array.isArray(value) ? value : [value];
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

function composeValidators(validators: ValidatorFn[] | null): ValidatorFn | null {
  if (!validators || validators.length === 0) return null;
  return (control) => mergeErrors(validators.map((validator) => validator(control)));
}

function toObservable(
  value: Observable<ValidationErrors | null> | Promise<ValidationErrors | null>,
): Observable<ValidationErrors | null> {
  return isObservable(value) ? value : from(value);
}

function composeAsyncValidators(validators: AsyncValidatorFn[] | null): AsyncValidatorFn | null {
  if (!validators || validators.length === 0) return null;
  return (control) => forkJoin(validators.map((validator) => toObservable(validator(control)))).pipe(map(mergeErrors));
}

/**
 * Base de `FormControl`/`FormGroup`/`FormArray` — mismo contrato público que
 * `AbstractControl` de `@angular/forms` (misma firma de `ValidatorFn`, misma
 * máquina de estados VALID/INVALID/PENDING/DISABLED). Reimplementada acá
 * porque AngularJS no tiene nada parecido: `NgModelController` valida un solo
 * input, no compone un árbol — es "brecha" (ver `CONCEPTOS.md`).
 *
 * `valueChanges`/`statusChanges` son `BehaviorSubject` (no `Subject` como en
 * Angular real, decisión de diseño documentada en `CONCEPTOS.md`): un
 * suscriptor tardío — típicamente el bridge que conecta un control recién
 * creado contra el DOM — ve el estado actual sin esperar el próximo cambio.
 *
 * Varios miembros con prefijo `_` son públicos a propósito, no `protected`
 * (mismo criterio que el `@angular/forms` real: `_forEachChild`,
 * `_updateValue`, `setParent`… son "internos" por convención de nombre, no
 * por visibilidad — hace falta que un `FormGroup` pueda llamarlos sobre sus
 * hijos, que no necesariamente son instancias de su misma subclase).
 *
 * Default `TValue = any` (no `unknown`) a propósito: `BehaviorSubject<TValue>`
 * hace que `TValue` aparezca en posición contravariante (`Observer.next`), así
 * que un `AbstractControl` sin tipar tiene que ser bivariante para poder
 * convivir en el mismo árbol con hijos de distinto tipo (`_parent`,
 * `get()`, `_forEachChild`…) — mismo motivo por el que `@angular/forms` usa
 * `any` en el mismo lugar.
 */
// biome-ignore lint/suspicious/noExplicitAny: bivarianza necesaria del árbol de controles, ver comentario arriba
export abstract class AbstractControl<TValue = any> {
  protected _value: TValue;
  protected _errors: ValidationErrors | null = null;
  protected _status: FormControlStatus;
  protected _pristine = true;
  protected _touched = false;
  protected _parent: AbstractControl | null = null;
  protected _validator: ValidatorFn | null;
  protected _asyncValidator: AsyncValidatorFn | null;
  protected _asyncValidationSubscription: Subscription | null = null;
  /**
   * Como Angular 16.2: su PROPIO validador async todavía no respondió. Sin esto, cuando un hijo termina el suyo, el
   * padre recalcula (`_calculateStatus`) sin hijos pendientes y pasa a `VALID` con su validador aún en vuelo.
   */
  private _hasOwnPendingAsyncValidator = false;

  private readonly valueChangesSubject: BehaviorSubject<TValue>;
  private readonly statusChangesSubject: BehaviorSubject<FormControlStatus>;

  readonly valueChanges: Observable<TValue>;
  readonly statusChanges: Observable<FormControlStatus>;

  protected constructor(
    value: TValue,
    validators: ValidatorFn | ValidatorFn[] | null,
    asyncValidators: AsyncValidatorFn | AsyncValidatorFn[] | null,
  ) {
    this._value = value;
    this._validator = composeValidators(coerceToArray(validators));
    this._asyncValidator = composeAsyncValidators(coerceToArray(asyncValidators));

    this.valueChangesSubject = new BehaviorSubject<TValue>(value);
    this.valueChanges = this.valueChangesSubject.asObservable();

    this._status = "VALID";
    this.statusChangesSubject = new BehaviorSubject<FormControlStatus>(this._status);
    this.statusChanges = this.statusChangesSubject.asObservable();
  }

  get value(): TValue {
    return this._value;
  }

  get status(): FormControlStatus {
    return this._status;
  }

  get valid(): boolean {
    return this._status === "VALID";
  }

  get invalid(): boolean {
    return this._status === "INVALID";
  }

  get pending(): boolean {
    return this._status === "PENDING";
  }

  /** Como Angular: el estado ES la fuente de verdad (un grupo con todos sus hijos deshabilitados también lo está). */
  get disabled(): boolean {
    return this._status === "DISABLED";
  }

  get enabled(): boolean {
    return this._status !== "DISABLED";
  }

  get errors(): ValidationErrors | null {
    return this._errors;
  }

  get pristine(): boolean {
    return this._pristine;
  }

  get dirty(): boolean {
    return !this._pristine;
  }

  get touched(): boolean {
    return this._touched;
  }

  get untouched(): boolean {
    return !this._touched;
  }

  get parent(): AbstractControl | null {
    return this._parent;
  }

  get root(): AbstractControl {
    let control: AbstractControl = this;
    while (control._parent) control = control._parent;
    return control;
  }

  get validator(): ValidatorFn | null {
    return this._validator;
  }

  get asyncValidator(): AsyncValidatorFn | null {
    return this._asyncValidator;
  }

  setValidators(validators: ValidatorFn | ValidatorFn[] | null): void {
    this._validator = composeValidators(coerceToArray(validators));
  }

  setAsyncValidators(validators: AsyncValidatorFn | AsyncValidatorFn[] | null): void {
    this._asyncValidator = composeAsyncValidators(coerceToArray(validators));
  }

  clearValidators(): void {
    this._validator = null;
  }

  clearAsyncValidators(): void {
    this._asyncValidator = null;
  }

  setParent(parent: AbstractControl | null): void {
    this._parent = parent;
  }

  markAsTouched(opts: ControlEventOptions = {}): void {
    this._touched = true;
    if (this._parent && !opts.onlySelf) this._parent.markAsTouched(opts);
  }

  markAsUntouched(opts: ControlEventOptions = {}): void {
    this._touched = false;
    this._forEachChild((control) => control.markAsUntouched({ onlySelf: true }));
    if (this._parent && !opts.onlySelf) this._parent._updateTouched(opts);
  }

  markAsDirty(opts: ControlEventOptions = {}): void {
    this._pristine = false;
    if (this._parent && !opts.onlySelf) this._parent.markAsDirty(opts);
  }

  markAsPristine(opts: ControlEventOptions = {}): void {
    this._pristine = true;
    this._forEachChild((control) => control.markAsPristine({ onlySelf: true }));
    if (this._parent && !opts.onlySelf) this._parent._updatePristine(opts);
  }

  markAsPending(opts: ControlEventOptions = {}): void {
    this._status = "PENDING";
    if (opts.emitEvent !== false) this.statusChangesSubject.next(this._status);
    if (this._parent && !opts.onlySelf) this._parent.markAsPending(opts);
  }

  disable(opts: ControlEventOptions = {}): void {
    // Primero el estado (como Angular): `_updateValue` de un grupo/array deshabilitado junta a TODOS sus hijos.
    this._status = "DISABLED";
    this._errors = null;
    this._forEachChild((control) => control.disable({ onlySelf: true, emitEvent: opts.emitEvent }));
    this._updateValue();

    if (opts.emitEvent !== false) {
      this.valueChangesSubject.next(this._value);
      this.statusChangesSubject.next(this._status);
    }

    if (this._parent && !opts.onlySelf) this._parent.updateValueAndValidity(opts);
  }

  enable(opts: ControlEventOptions = {}): void {
    this._status = "VALID";
    this._forEachChild((control) => control.enable({ onlySelf: true, emitEvent: opts.emitEvent }));
    this.updateValueAndValidity({ onlySelf: true, emitEvent: opts.emitEvent });
    if (this._parent && !opts.onlySelf) this._parent.updateValueAndValidity(opts);
  }

  setErrors(errors: ValidationErrors | null, opts: { emitEvent?: boolean } = {}): void {
    this._errors = errors;
    this._updateControlsErrors(opts.emitEvent !== false);
  }

  get(path: string | ReadonlyArray<string | number>): AbstractControl | null {
    const segments: ReadonlyArray<string | number> =
      typeof path === "string" ? path.split(".").filter((segment) => segment.length > 0) : path;
    let control: AbstractControl | null = this;
    for (const segment of segments) {
      control = control?._find(segment) ?? null;
      if (!control) return null;
    }
    return control;
  }

  getError(errorCode: string, path?: string | ReadonlyArray<string | number>): unknown {
    const control = path ? this.get(path) : (this as AbstractControl);
    return control?.errors?.[errorCode] ?? null;
  }

  hasError(errorCode: string, path?: string | ReadonlyArray<string | number>): boolean {
    return this.getError(errorCode, path) !== null;
  }

  updateValueAndValidity(opts: ControlEventOptions = {}): void {
    // `_setInitialStatus` de Angular: un grupo/array con todos sus hijos deshabilitados queda DISABLED.
    this._status = this._allControlsDisabled() ? "DISABLED" : "VALID";
    this._updateValue();

    if (this.enabled) {
      this._cancelExistingAsyncValidation();
      this._errors = this._validator ? this._validator(this) : null;
      this._status = this._calculateStatus();

      if (this._status === "VALID" || this._status === "PENDING") {
        this._runAsyncValidator(opts.emitEvent !== false);
      }
    }

    if (opts.emitEvent !== false) {
      this.valueChangesSubject.next(this._value);
      this.statusChangesSubject.next(this._status);
    }

    if (this._parent && !opts.onlySelf) this._parent.updateValueAndValidity(opts);
  }

  abstract setValue(value: unknown, opts?: ControlEventOptions): void;
  abstract patchValue(value: unknown, opts?: ControlEventOptions): void;
  abstract reset(value?: unknown, opts?: ControlEventOptions): void;
  /** Como `value`, pero incluye controles `disabled` (`value` los omite del árbol). */
  abstract getRawValue(): unknown;

  /**
   * `FormControl`: si él está deshabilitado. `FormGroup`/`FormArray`: si todos sus hijos lo están (y tiene alguno) —
   * sin hijos, su propio estado. Como `_allControlsDisabled` de Angular.
   */
  protected _allControlsDisabled(): boolean {
    return this.disabled;
  }

  /** Recorre los hijos: si ninguno está habilitado, todos deshabilitados (ver `_allControlsDisabled`). */
  protected _allChildrenDisabled(): boolean {
    let count = 0;
    let anyEnabled = false;
    this._forEachChild((control) => {
      count++;
      anyEnabled = anyEnabled || control.enabled;
    });
    return anyEnabled ? false : count > 0 || this.disabled;
  }

  /** No-op en `FormControl` (sin hijos); recorre `controls` en `FormGroup`/`FormArray`. */
  protected _forEachChild(_callback: (control: AbstractControl) => void): void {}

  /** `null` en `FormControl`; busca por clave/índice en `FormGroup`/`FormArray`. */
  protected _find(_segment: string | number): AbstractControl | null {
    return null;
  }

  /** No-op en `FormControl` (el valor lo pone `setValue`); recalcula desde `controls` en el resto. */
  protected _updateValue(): void {}

  _updateTouched(opts: ControlEventOptions = {}): void {
    this._touched = this._anyControlsTouched();
    if (this._parent && !opts.onlySelf) this._parent._updateTouched(opts);
  }

  _updatePristine(opts: ControlEventOptions = {}): void {
    this._pristine = !this._anyControlsDirty();
    if (this._parent && !opts.onlySelf) this._parent._updatePristine(opts);
  }

  private _updateControlsErrors(emitEvent: boolean): void {
    this._status = this._calculateStatus();
    if (emitEvent) this.statusChangesSubject.next(this._status);
    this._parent?._updateControlsErrors(emitEvent);
  }

  private _calculateStatus(): FormControlStatus {
    if (this._allControlsDisabled()) return "DISABLED";
    if (this._errors) return "INVALID";
    if (this._hasOwnPendingAsyncValidator || this._anyControlsHaveStatus("PENDING")) return "PENDING";
    if (this._anyControlsHaveStatus("INVALID")) return "INVALID";
    return "VALID";
  }

  private _anyControlsHaveStatus(status: FormControlStatus): boolean {
    let found = false;
    this._forEachChild((control) => {
      found = found || control.status === status;
    });
    return found;
  }

  private _anyControlsTouched(): boolean {
    let found = false;
    this._forEachChild((control) => {
      found = found || control.touched;
    });
    return found;
  }

  private _anyControlsDirty(): boolean {
    let found = false;
    this._forEachChild((control) => {
      found = found || control.dirty;
    });
    return found;
  }

  private _cancelExistingAsyncValidation(): void {
    this._asyncValidationSubscription?.unsubscribe();
    this._asyncValidationSubscription = null;
    this._hasOwnPendingAsyncValidator = false;
  }

  private _runAsyncValidator(emitEvent: boolean): void {
    if (!this._asyncValidator) return;
    this._status = "PENDING";
    this._hasOwnPendingAsyncValidator = true;
    this._asyncValidationSubscription = toObservable(this._asyncValidator(this)).subscribe((errors) => {
      this._hasOwnPendingAsyncValidator = false;
      this.setErrors(errors, { emitEvent });
    });
  }
}
