import type { IAugmentedJQuery, IController, IDirective, IScope, ITranscludeFunction } from "angular";
import { ViewContainerRef, type ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

/**
 * `<ng-container>` pelado (sin `@Directive`) — sin huella en el DOM
 * (`transclude: 'element'`). No renderiza su contenido solo: es un ancla para
 * insertar vistas/componentes a mano vía `viewContainerRef` (el mismo que arma
 * `view-container-ref-bridge.ts`, pedido por ctor — no uno propio).
 */
export class NgContainer implements IController {
  static readonly $inject = ["$transclude", "$scope", ViewContainerRef.$name];

  constructor(
    private readonly $transclude: ITranscludeFunction,
    private readonly $scope: IScope,
    public readonly viewContainerRef: ViewContainerRef,
  ) {}

  $postLink(): void {
    this.$transclude(this.$scope, (clone: IAugmentedJQuery | undefined) => {
      clone?.remove();
    });
  }

  $onDestroy(): void {
    (this.viewContainerRef as ViewContainerRefImpl).clear();
  }

  static $factory(): IDirective {
    return {
      controller: NgContainer,
      restrict: "E",
      bindToController: true,
      transclude: "element",
    };
  }
}
