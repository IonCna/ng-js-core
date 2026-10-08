import type angular from "angular";
import { Inject } from "@/core/di/inject.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { findAncestorControl } from "@/forms/control-container.ts";
import type { ValidationErrors } from "@/forms/types.ts";

interface NgModelController {
  $modelValue: unknown;
  $viewChangeListeners: Array<() => void>;
  $setTouched(): void;
  $setValidity(key: string, isValid: boolean): void;
}

/** Mismo mecanismo que `applyErrorKeys` de `ng-validators-bridge.ts` (duplicado a propósito: bridges autocontenidos). */
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
 * `formControlName` — ata el `FormControl` (resuelto por nombre/índice contra
 * el `[formGroup]`/`formArrayName` ancestro) al `NgModelController` real del
 * mismo elemento (instanciado gracias al `ng-model` que `[formGroup]` ya
 * inyectó en `compile`, ver `form-group-directive.ts`). Mismo patrón de
 * wiring que `control-value-accessor-bridge.ts`, pero sin CVA de por medio —
 * acá el "accessor" es el propio `ngModel` nativo (formatters/parsers/eventos
 * DOM intactos, sin neutralizar nada):
 *
 *  - `control.value` → en cada digest, si difiere de ella, se escribe en la MISMA expresión de scope que el
 *    `ng-model` sintético apunta (`$parse(...).assign`, igual que hace
 *    `ngModelSet` internamente) — NO se toca `ngModel.$modelValue`/`$render`
 *    a mano. **Bug real encontrado con un test**: escribir `$modelValue`
 *    directo se perdía porque el watcher NATIVO de `ngModel` (que sigue vivo,
 *    mirando esa misma expresión) corre su propio chequeo inicial una sola
 *    vez y no hay revancha — un `$watch` no reintenta si SU propia expresión
 *    watcheada no cambió, así que "pisar y competir" no funciona pase lo que
 *    pase del otro lado. Escribiendo la expresión en sí, en cambio, hay un
 *    solo dueño del render (el watcher nativo, que ya sabe hacerlo bien) y
 *    cero carrera. Confirmado con `test/runtime/reactive-forms.test.ts`.
 *  - `ngModel.$viewChangeListeners` (AngularJS ya corrió `$parsers` para
 *    cuando dispara esto) → `control.setValue(ngModel.$modelValue)` +
 *    `markAsDirty()`
 *  - `ngModel.$setTouched` (envuelto, no reemplazado) → además
 *    `control.markAsTouched()`
 *  - `control.errors`/`statusChanges` → `ngModel.$setValidity` por clave
 *    (mismo mecanismo que `ng-validators-bridge.ts`) + `disabled` reflejado
 *    en el elemento
 */
@Directive({ selector: "[formControlName]" })
export class FormControlNameDirective {
  /** Un nombre (o índice) estático, como en Angular: `form-control-name="email"`. */
  @Input({ binding: "@" }) formControlName!: string;

  constructor(
    @Inject("$element") private readonly $element: angular.IAugmentedJQuery,
    @Inject("$scope") private readonly $scope: angular.IScope,
    @Inject("$parse") private readonly $parse: angular.IParseService,
  ) {}

  $postLink(): void {
    const parent = findAncestorControl(this.$element);
    if (!parent) {
      throw new Error(`formControlName="${this.formControlName}": no hay ningún [formGroup]/formArrayName ancestro`);
    }
    const control = parent.get([this.formControlName]);
    if (!control) {
      throw new Error(`formControlName="${this.formControlName}": no se encontró ese control en el ancestro`);
    }

    const ngModel = this.$element.controller("ngModel") as NgModelController | null;
    if (!ngModel) return;

    const modelExpr = this.$element.attr("ng-model");
    const getModelExpr = modelExpr ? this.$parse(modelExpr) : undefined;
    const setModelExpr = getModelExpr?.assign;
    if (!getModelExpr || !setModelExpr) return;

    const seenErrorKeys = new Set<string>();

    // En Angular todo `setValue`/`reset` programático escribe en la vista. Por eso en cada digest se compara
    // `control.value` contra lo que hoy tiene la expresión del `ng-model`, y no contra el valor que este watcher
    // vio en el digest anterior: con esa comparación se perdía todo cambio que devolviera el control a su valor
    // anterior dentro del mismo turno (tipear "x" y que un suscriptor de `valueChanges` lo corrija a "", o un
    // `reset()` antes del digest), y el input se quedaba con lo tipeado.
    //
    // El watcher devuelve cuántas veces escribió: el watcher nativo de `ngModel` se registró antes y en cada pasada
    // del digest corre primero, así que la escritura de esta pasada recién la ve en la siguiente. Si este watcher no
    // se mostrara "sucio", un digest sin ningún otro cambio terminaba ahí y el input quedaba un digest atrasado.
    let writes = 0;
    this.$scope.$watch(() => {
      const value: unknown = control.value;
      if (!Object.is(getModelExpr(this.$scope), value)) {
        setModelExpr(this.$scope, value);
        writes += 1;
      }
      return writes;
    });
    const applyStatus = () => {
      applyErrorKeys(ngModel, control.errors, seenErrorKeys);
      this.$element.prop("disabled", control.disabled);
    };
    // `statusChanges` solo avisa cambios: el estado con el que llega el control se aplica acá.
    applyStatus();
    control.statusChanges.subscribe(applyStatus);

    // Va PRIMERO en la lista (`unshift`, no `push`): este `$postLink` corre después del `link` de cualquier otra
    // directiva del elemento, así que con `push` un listener ajeno (`ng-change`) corría antes y leía en
    // `control.value` el valor anterior. En Angular el value accessor actualiza el control antes de que corra el
    // handler de la plantilla (`(input)`, `(ngModelChange)`): quien escucha el cambio ya ve el valor nuevo.
    ngModel.$viewChangeListeners.unshift(() => {
      control.setValue(ngModel.$modelValue);
      control.markAsDirty();
    });

    const nativeSetTouched = ngModel.$setTouched.bind(ngModel);
    ngModel.$setTouched = () => {
      nativeSetTouched();
      control.markAsTouched();
    };
  }
}
