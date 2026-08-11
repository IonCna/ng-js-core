import type { IAugmentedJQuery, IController, IDirective, IScope, ITranscludeFunction } from "angular";
import { ElementRef } from "@/core";
import { ViewContainerRef } from "@/core/refs";

export class ContentRef implements IController {
  private readonly _viewContainerRef: ViewContainerRef;

  constructor(
    $element: IAugmentedJQuery,
    private $transclude: ITranscludeFunction,
    private $scope: IScope,
  ) {
    const [native] = Array.from($element);

    const elementRef = new ElementRef(native);
    this._viewContainerRef = new ViewContainerRef(elementRef);
  }

  get viewContainerRef(): ViewContainerRef {
    return this._viewContainerRef;
  }

  $postLink() {
    this.$transclude(this.$scope, (clone) => {
      if (!clone) return;
      clone.remove();
    });
  }

  $onDestroy() {
    this._viewContainerRef.clear();
  }

  static $factory(): IDirective {
    return {
      controller: ContentRef,
      restrict: "E",
      bindToController: true,
      transclude: "element",
    };
  }

  static get $inject() {
    return ["$element", "$transclude", "$scope"];
  }

  static get $name() {
    return "ngContainer";
  }
}
