import type angular from "angular";

const CONTROL_NAME_SELECTOR = "[form-control-name],[form-array-name]";
let scratchCounter = 0;

function injectSyntheticNgModel(element: angular.IAugmentedJQuery): void {
  const root = element[0] as Element;
  const nodes = root.querySelectorAll(CONTROL_NAME_SELECTOR);
  for (const node of Array.from(nodes)) {
    if (!node.hasAttribute("ng-model")) node.setAttribute("ng-model", `$$ngjsFcn${scratchCounter++}`);
  }
}

/** Prepara los controles reactivos antes de que AngularJS compile sus hijos. */
export function decorateFormGroupDirective($delegate: angular.IDirective[]): angular.IDirective[] {
  return $delegate.map((definition) => {
    const compile = definition.compile;
    definition.compile = (element, attrs, transclude) => {
      injectSyntheticNgModel(element);
      return compile?.(element, attrs, transclude);
    };
    return definition;
  });
}

decorateFormGroupDirective.$inject = ["$delegate"];
