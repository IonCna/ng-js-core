import type angular from "angular";
import { resolveForwardRef } from "@/core/di/forward-ref.ts";
import type { Provider } from "@/core/di/provider.ts";
import { getComponentDef } from "@/core/metadata/define-component.ts";
import { getDirectiveDef } from "@/core/metadata/directive.ts";
import type { ControlValueAccessor } from "@/forms/control-value-accessor.ts";
import { NG_VALUE_ACCESSOR } from "@/forms/ng-value-accessor.ts";
import { chainInstanceMethod, decorateControllerWith } from "@/runtime/bridges/shared.ts";

interface NgModelController {
  $render: () => void;
  $viewValue: unknown;
  $modelValue: unknown;
  $setViewValue: (value: unknown, trigger?: string) => void;
  $setTouched?: () => void;
  $formatters: unknown[];
  $parsers: unknown[];
}

/**
 * Eventos DOM que el directive `input`/`textarea`/`select` nativo de AngularJS
 * engancha con jqLite `.on()` para hacer `ctrl.$setViewValue(element.value)`.
 * Cuando el elemento declara su propio `NG_VALUE_ACCESSOR`, ese sync built-in
 * pelea con el accessor (empuja el string crudo del DOM al modelo). Se
 * desenganchan; un accessor que sí quiere escuchar el DOM usa `addEventListener`,
 * que jqLite `.off()` no toca.
 */
const NATIVE_INPUT_SYNC_EVENTS = "input change compositionstart compositionend compositionupdate drop";

const NATIVE_FORM_CONTROL_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** `providers` (aplanado) declara un provider para `NG_VALUE_ACCESSOR`. Es el opt-in. */
function declaresNgValueAccessor(providers: Provider[] | undefined): boolean {
  if (!providers) return false;
  const flat = (providers as unknown[]).flat(Infinity) as Array<{ provide?: unknown }>;
  return flat.some(
    (entry) => typeof entry === "object" && entry !== null && resolveForwardRef(entry.provide) === NG_VALUE_ACCESSOR,
  );
}

function isControlValueAccessor(value: unknown): value is ControlValueAccessor {
  const cva = value as Partial<ControlValueAccessor> | null;
  return (
    !!cva &&
    typeof cva.writeValue === "function" &&
    typeof cva.registerOnChange === "function" &&
    typeof cva.registerOnTouched === "function"
  );
}

/**
 * Adapta un `ControlValueAccessor` estilo Angular al `ngModelController` de
 * AngularJS. Cuando una directiva/componente:
 *
 *  1. cumple la forma `ControlValueAccessor` (los 4 métodos), y
 *  2. se declaró como tal (`providers: [{ provide: NG_VALUE_ACCESSOR, ... }]`),
 *
 * y el mismo elemento lleva `ngModel`, se conecta en el `$postLink`:
 *
 *  - `ngModel.$render`        → `cva.writeValue(ngModel.$modelValue)`  (valor crudo)
 *  - `cva.registerOnChange`   → `$setViewValue` (dentro de un `$evalAsync`)
 *  - `cva.registerOnTouched`  → `$setTouched`
 *  - `cva.setDisabledState`   → `$observe('disabled')` (cubre también
 *                               `ngDisabled`, que escribe ese atributo)
 *
 * En Angular, proveer `NG_VALUE_ACCESSOR` hace que el framework NO instancie el
 * `DefaultValueAccessor`. AngularJS no tiene ese opt-out: el directive `input`
 * nativo siempre corre sobre el `ngModel`. Sobre un `<input>`/`<textarea>`/
 * `<select>` este bridge lo neutraliza para que el accessor sea el único
 * lector/escritor:
 *
 *  - vacía `ngModel.$formatters` (el nativo mete un `v => v.toString()` que
 *    convertiría un modelo objeto en `"[object Object]"`) y `$parsers`,
 *  - desengancha los listeners DOM del sync nativo (`NATIVE_INPUT_SYNC_EVENTS`).
 *
 * Sin `ngModel` en el elemento los métodos quedan dormidos — igual que en
 * Angular sin una directiva de formulario.
 */
export function decorateControllerControlValueAccessor(
  $delegate: angular.IControllerService,
): angular.IControllerService {
  return decorateControllerWith($delegate, {
    onInstance: (instance, locals) => {
      if (!isControlValueAccessor(instance)) return;

      const Clase = (instance as { constructor: Function }).constructor;
      const def = getComponentDef(Clase) ?? getDirectiveDef(Clase);
      if (!declaresNgValueAccessor(def?.providers)) return;

      const $element = locals?.$element as angular.IAugmentedJQuery | undefined;
      const $scope = locals?.$scope as angular.IScope | undefined;
      const $attrs = locals?.$attrs as angular.IAttributes | undefined;
      if (!$element || !$scope) return;

      const accessor = instance as ControlValueAccessor;
      const isNativeFormControl = NATIVE_FORM_CONTROL_TAGS.has(($element[0] as Element)?.tagName ?? "");

      chainInstanceMethod(instance as object, "$postLink", () => {
        const ngModel = $element.controller("ngModel") as NgModelController | null;
        if (!ngModel) return;

        if (isNativeFormControl) {
          // El directive `input` nativo ya linkeó: sacarle sus aportes al `ngModel`.
          ngModel.$formatters.length = 0;
          ngModel.$parsers.length = 0;
          $element.off(NATIVE_INPUT_SYNC_EVENTS);
        }

        ngModel.$render = () => accessor.writeValue(ngModel.$modelValue);

        accessor.registerOnChange((value: unknown) => {
          $scope.$evalAsync(() => ngModel.$setViewValue(value));
        });
        accessor.registerOnTouched(() => {
          $scope.$evalAsync(() => ngModel.$setTouched?.());
        });

        // `ngModel` corre su primer `$render` recién en el próximo digest; si el
        // modelo ya trae valor lo empujamos ahora para no depender del orden.
        if (ngModel.$modelValue !== undefined && !Number.isNaN(ngModel.$modelValue as number)) {
          accessor.writeValue(ngModel.$modelValue);
        }

        if (accessor.setDisabledState && $attrs) {
          $attrs.$observe("disabled" as never, (value: unknown) => {
            accessor.setDisabledState?.(value !== undefined && value !== false);
          });
        }
      });
    },
  });
}
decorateControllerControlValueAccessor.$inject = ["$delegate"];
