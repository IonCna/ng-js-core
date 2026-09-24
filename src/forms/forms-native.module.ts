import angular from "angular";

/**
 * Lo imperativo de reactive forms: `[formGroup]` agrega un `ng-model` sintético a cada `formControlName`/
 * `formArrayName` de adentro ANTES de que AngularJS compile los hijos — así cada control tiene un `NgModelController`
 * real (validación, `$touched`, eventos del input nativo) sin que el autor escriba `ng-model`. Es una segunda
 * directiva `formGroup` (AngularJS aplica todas las que comparten nombre) con solo `compile`: la del `@Directive`
 * compilado sigue siendo la que publica el `FormGroup`.
 */
class SyntheticNgModel {
  private static readonly SELECTOR = "[form-control-name],[form-array-name]";
  private static next = 0;

  static directive(): angular.IDirective {
    return {
      restrict: "A",
      compile: (element) => {
        const root = element[0] as Element;
        for (const node of Array.from(root.querySelectorAll(SyntheticNgModel.SELECTOR))) {
          if (!node.hasAttribute("ng-model")) node.setAttribute("ng-model", `$$ngjsFcn${SyntheticNgModel.next++}`);
        }
      },
    };
  }
}

export const FormsNativeModule: angular.IModule = angular.module("ng.js.forms", []).directive("formGroup", SyntheticNgModel.directive);
