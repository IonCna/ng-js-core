/**
 * Mismo contrato que `@angular/forms`: un componente/directiva que sabe leer y
 * escribir el valor de un control de formulario. Lo consumen los componentes
 * portados de `ng-bootstrap` (`NgbRating`, `NgbTypeahead`, …) tal cual.
 *
 * El puente con AngularJS lo hace `control-value-accessor-bridge.ts`: cuando el
 * elemento tiene además `ngModel`, conecta estos 4 métodos con el
 * `ngModelController` nativo (`$render` ↔ `writeValue`, `$setViewValue` ↔
 * `registerOnChange`, `$setTouched` ↔ `registerOnTouched`).
 */
export interface ControlValueAccessor {
  /** El modelo cambió: pintar `value` en la vista. */
  writeValue(value: unknown): void;
  /** Registrar el callback a llamar cuando la vista cambia el valor. */
  registerOnChange(fn: (value: unknown) => void): void;
  /** Registrar el callback a llamar cuando el control es "tocado" (blur). */
  registerOnTouched(fn: () => void): void;
  /** El estado disabled del control cambió desde el modelo de formularios. */
  setDisabledState?(isDisabled: boolean): void;
}
