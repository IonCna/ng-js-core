import type angular from "angular";
import { firstValueFrom, isObservable, type Observable } from "rxjs";
import { resolveForwardRef } from "@/core/di/forward-ref.ts";
import type { Provider } from "@/core/di/provider.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import type { AbstractControl } from "@/forms/abstract-control.ts";
import { NG_ASYNC_VALIDATORS, NG_VALIDATORS } from "@/forms/ng-validators.ts";
import type { ValidationErrors } from "@/forms/types.ts";
import type { AsyncValidator, Validator } from "@/forms/validator.ts";
import { chainInstanceMethod, decorateControllerWith } from "@/native/bridges/shared.ts";

interface NgModelController {
  $modelValue: unknown;
  $viewValue: unknown;
  $validate(): void;
  $validators: Record<string, (modelValue: unknown, viewValue: unknown) => boolean>;
  $asyncValidators: Record<string, (modelValue: unknown, viewValue: unknown) => PromiseLike<unknown>>;
  $setValidity(key: string, isValid: boolean): void;
  /** Expandos propios — un array compartido por todas las directivas Validator/AsyncValidator del mismo elemento. */
  $ngjsSyncValidators?: Validator[];
  $ngjsAsyncValidators?: AsyncValidator[];
}

const SYNC_KEY = "ngjsValidators";
const ASYNC_KEY = "ngjsAsyncValidators";

/** `providers` (aplanado) declara un provider para `token`. Mismo opt-in que `NG_VALUE_ACCESSOR`. */
function declaresProvider(providers: Provider[] | undefined, token: unknown): boolean {
  if (!providers) return false;
  const flat = (providers as unknown[]).flat(Number.POSITIVE_INFINITY) as Array<{ provide?: unknown }>;
  return flat.some(
    (entry) => typeof entry === "object" && entry !== null && resolveForwardRef(entry.provide) === token,
  );
}

function hasValidateMethod(value: unknown): value is { validate: (control: AbstractControl) => unknown } {
  return !!value && typeof (value as { validate?: unknown }).validate === "function";
}

/**
 * `AbstractControl` real necesita un árbol (`FormGroup`/padres) que acá no
 * existe: sin `[formGroup]`/`formControlName` de por medio, un `Validator`
 * sobre `ngModel` solo tiene el valor del control. Se arma un objeto que
 * cumple el único miembro que `Validators.*` (`src/forms/validators.ts`) y
 * cualquier `Validator` custom razonable necesitan — `.value` — y se castea.
 * Brecha documentada: `control.parent`/`.get()`/etc. no están disponibles acá.
 */
function createValueOnlyControl(value: unknown): AbstractControl {
  return { value } as AbstractControl;
}

function toPromise(
  value: Observable<ValidationErrors | null> | Promise<ValidationErrors | null>,
): Promise<ValidationErrors | null> {
  return isObservable(value) ? firstValueFrom(value) : value;
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
 * Refleja cada clave del `ValidationErrors` combinado como una entrada de
 * `$error` de verdad (vía `$setValidity`, no tocando `$error` a mano) — así
 * `$error.required`/`$error.min`/… quedan disponibles igual que en Angular
 * real (`control.hasError('min')`), listo para cuando se cablee `ngMessages`.
 * Además de eso, borra las claves que dejaron de fallar desde la corrida
 * anterior (`$setValidity` no lo hace solo: no sabe qué claves puso este
 * validador la vez pasada).
 */
function applyErrorKeys(ngModel: NgModelController, errors: ValidationErrors | null, previousKeys: Set<string>): void {
  const nextKeys = new Set(errors ? Object.keys(errors) : []);
  for (const key of previousKeys) {
    if (!nextKeys.has(key)) ngModel.$setValidity(key, true);
  }
  for (const key of nextKeys) ngModel.$setValidity(key, false);
  previousKeys.clear();
  for (const key of nextKeys) previousKeys.add(key);
}

/**
 * Engancha `ngModel.$validators[SYNC_KEY]` una sola vez por control (idempotente:
 * puede correr desde el `$postLink` de varias directivas `Validator` del mismo
 * elemento, en cualquier orden). La función corre TODOS los validadores
 * acumulados en `$ngjsSyncValidators` en cada evaluación — agregar una
 * directiva más tarde no requiere volver a registrar nada.
 */
function ensureSyncValidatorWired(ngModel: NgModelController): Validator[] {
  if (!ngModel.$ngjsSyncValidators) {
    ngModel.$ngjsSyncValidators = [];
    const seenKeys = new Set<string>();
    ngModel.$validators[SYNC_KEY] = () => {
      const control = createValueOnlyControl(ngModel.$modelValue);
      const merged = mergeErrors(
        (ngModel.$ngjsSyncValidators as Validator[]).map((validator) => validator.validate(control)),
      );
      applyErrorKeys(ngModel, merged, seenKeys);
      return merged === null;
    };
  }
  return ngModel.$ngjsSyncValidators;
}

/** Mismo mecanismo que `ensureSyncValidatorWired`, para `$asyncValidators`. */
function ensureAsyncValidatorWired(ngModel: NgModelController): AsyncValidator[] {
  if (!ngModel.$ngjsAsyncValidators) {
    ngModel.$ngjsAsyncValidators = [];
    const seenKeys = new Set<string>();
    ngModel.$asyncValidators[ASYNC_KEY] = () => {
      const control = createValueOnlyControl(ngModel.$modelValue);
      const validators = ngModel.$ngjsAsyncValidators as AsyncValidator[];
      return Promise.all(validators.map((validator) => toPromise(validator.validate(control)))).then((results) => {
        const merged = mergeErrors(results);
        applyErrorKeys(ngModel, merged, seenKeys);
        // AngularJS: resolve = válido, reject = inválido (`$asyncValidators` nativo).
        return merged === null ? undefined : Promise.reject(merged);
      });
    };
  }
  return ngModel.$ngjsAsyncValidators;
}

/**
 * Adapta `Validator`/`AsyncValidator` estilo Angular (`src/forms/validator.ts`)
 * al `NgModelController` de AngularJS. Cuando una directiva/componente:
 *
 *  1. implementa `validate(control)`, y
 *  2. se declaró como tal (`providers: [{ provide: NG_VALIDATORS, ... }]` y/o
 *     `NG_ASYNC_VALIDATORS`),
 *
 * y el mismo elemento lleva `ngModel`, se conecta en el `$postLink`: la
 * instancia se agrega a una lista compartida (una por `ngModel`, no una por
 * directiva) y esa lista corre completa en un único `$validators`/
 * `$asyncValidators` de AngularJS. Cada clave del `ValidationErrors`
 * combinado se refleja en `$error` vía `$setValidity` (ver `applyErrorKeys`).
 *
 * `$asyncValidators` solo corre si `$validators` pasó primero — comportamiento
 * nativo de AngularJS, igual que Angular real.
 *
 * Brecha chica confirmada con un probe real: además de las claves reales
 * (`$error.required`, `$error.taken`, …) queda una clave extra en `$error`
 * con el nombre interno del bridge (`SYNC_KEY`/`ASYNC_KEY`) — es AngularJS
 * mismo llamando `$setValidity` para SU propia entrada del mapa
 * `$validators`/`$asyncValidators`, no algo que este bridge pueda evitar sin
 * dejar de usar ese mapa (y perder el enganche automático a cada cambio de
 * valor). No afecta `$valid`/`$invalid` ni las claves reales.
 *
 * Sin `ngModel` en el elemento los métodos quedan dormidos.
 */
export function decorateControllerNgValidators($delegate: angular.IControllerService): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!hasValidateMethod(instance)) return;

      const Clase = (instance as { constructor: Function }).constructor;
      const def = getComponentDef(Clase) ?? getDirectiveDef(Clase);
      const isSyncValidator = declaresProvider(def?.providers, NG_VALIDATORS);
      const isAsyncValidator = declaresProvider(def?.providers, NG_ASYNC_VALIDATORS);
      if (!isSyncValidator && !isAsyncValidator) return;

      const $element = locals?.$element as angular.IAugmentedJQuery | undefined;
      if (!$element) return;

      chainInstanceMethod(instance as object, "$postLink", () => {
        const ngModel = $element.controller("ngModel") as NgModelController | null;
        if (!ngModel) return;

        if (isSyncValidator) ensureSyncValidatorWired(ngModel).push(instance as Validator);
        if (isAsyncValidator) ensureAsyncValidatorWired(ngModel).push(instance as AsyncValidator);

        // El `ngModel` ya pudo haber corrido su primer `$validate()` antes de
        // que esta directiva linkeara (orden de directivas en el mismo
        // elemento no está garantizado) — forzar una corrida ahora.
        ngModel.$validate();
      });
    },
  });
}
decorateControllerNgValidators.$inject = ["$delegate"];
