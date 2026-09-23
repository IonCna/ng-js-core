import type angular from "angular";
import type { FormGroup } from "@/forms/form-group.ts";
import { publishControlContainer } from "@/runtime/forms/control-container.ts";

const CONTROL_NAME_SELECTOR = "[form-control-name],[form-array-name]";

/**
 * Contador global, no por instancia: cada `formControlName`/`formArrayName`
 * sin `ng-model` propio recibe una expresión de scope descartable y única
 * (nunca se lee de vuelta — el sync real es `FormControl` ↔
 * `NgModelController`, ver `form-control-name-directive.ts`). Solo hace falta
 * que `$parse` no truene.
 */
let scratchCounter = 0;

/**
 * `ngModel` solo lo instancia AngularJS si el atributo `ng-model` está
 * presente en el HTML — y en Angular real `formControlName`/`formArrayName`
 * no llevan `ng-model` al lado. Se lo inyectamos nosotros ACÁ, en el
 * `compile` de `[formGroup]` (corre antes de que AngularJS baje a compilar
 * los hijos — `DirectiveDef.compile`, confirmado leyendo
 * `buildDirectiveDefinition`/`compileNodes` antes de decidir esto), sobre
 * cada descendiente `form-control-name`/`form-array-name` que no tenga uno
 * ya. Así `<input formControlName="email">` alcanza solo, y por debajo corre
 * el `NgModelController` real de punta a punta — mismo mecanismo que ya usa
 * `control-value-accessor-bridge.ts` para CVA.
 */
function injectSyntheticNgModel(element: angular.IAugmentedJQuery): void {
  const root = element[0] as Element;
  const nodes = root.querySelectorAll(CONTROL_NAME_SELECTOR);
  for (const node of Array.from(nodes)) {
    if (!node.hasAttribute("ng-model")) {
      node.setAttribute("ng-model", `$$ngjsFcn${scratchCounter++}`);
    }
  }
}

/**
 * `[formGroup]` — ata un `FormGroup` (shim de `src/forms/`) al DOM. Publica
 * el control (`$onInit`, antes de que AngularJS linkee los hijos — ver
 * `control-container.ts`) para que `formControlName`/`formArrayName`
 * descendientes lo encuentren.
 */
export class FormGroupDirective {
  static readonly $inject = ["$element"];
  formGroup!: FormGroup;

  constructor(private readonly $element: angular.IAugmentedJQuery) {}

  $onInit(): void {
    publishControlContainer(this.$element, this.formGroup);
  }

  static $factory(): angular.IDirective {
    return {
      controller: FormGroupDirective,
      restrict: "A",
      bindToController: { formGroup: "<" },
      compile: (element: angular.IAugmentedJQuery) => {
        injectSyntheticNgModel(element);
      },
    };
  }
}
