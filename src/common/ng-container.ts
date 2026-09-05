import type { IAugmentedJQuery, IController, IDirective, IScope, ITranscludeFunction } from "angular";
import { ViewContainerRef, ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

/**
 * `<ng-container>` — sin huella en el DOM (`transclude: 'element'`, como
 * `ng-if`/`ng-repeat`: se reemplaza por un comentario). No renderiza su
 * contenido solo — es un ancla para insertar vistas/componentes a mano vía
 * `viewContainerRef`. El VCR NO es uno propio: es el mismo que ya arma
 * `view-container-ref-bridge.ts` para cualquier controller (se pide por
 * ctor, como cualquier otro token) — evita duplicar instancias para el
 * mismo elemento.
 */
export class NgContainer implements IController {
  static readonly $inject = ["$transclude", "$scope", ViewContainerRef.$name];

  constructor(
    private readonly $transclude: ITranscludeFunction,
    private readonly $scope: IScope,
    public readonly viewContainerRef: ViewContainerRef,
  ) {}

  $postLink(): void {
    // clona el propio contenido y lo descarta: a diferencia de Angular real,
    // acá NO se renderiza solo — hay que insertarlo a mano vía viewContainerRef.
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
