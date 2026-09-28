import type angular from "angular";
import { ElementRefImpl } from "@/core/refs/element-ref.ts";
import { ViewContainerRefImpl } from "@/core/refs/view-container-ref.ts";

/**
 * `<ng-container>`: agrupa sin agregar un elemento al DOM. Directiva nativa (`NativeModule`) con
 * `transclude: "element"`: el propio tag nunca se renderiza (queda un comentario de ancla) y su contenido va en su
 * lugar, como en Angular. Además es ancla de un `ViewContainerRef` (`viewContainerRef`, `require: "ngContainer"`)
 * para insertar vistas/componentes dinámicos ahí; se limpia al destruirse.
 */
export class NgContainer implements angular.IController {
  static readonly $inject = ["$transclude", "$scope", "$element", "$injector"];

  /** Por comentario ancla: jqLite no guarda `data()` en un comentario, así que `$element.data()` no sirve acá. */
  private static readonly byAnchor = new WeakMap<Node, NgContainer>();

  /** El `<ng-container>` de ese comentario ancla (fuera de un `require: "ngContainer"`). */
  static of(anchor: Node): NgContainer | undefined {
    return NgContainer.byAnchor.get(anchor);
  }

  readonly viewContainerRef: ViewContainerRefImpl;
  private content?: angular.IAugmentedJQuery;

  constructor(
    private readonly $transclude: angular.ITranscludeFunction,
    private readonly $scope: angular.IScope,
    private readonly $element: angular.IAugmentedJQuery,
    $injector: angular.auto.IInjectorService,
  ) {
    this.viewContainerRef = new ViewContainerRefImpl(new ElementRefImpl($element[0] as HTMLElement), $injector);
    NgContainer.byAnchor.set($element[0] as Node, this);
  }

  $postLink(): void {
    // El contenido va donde estaba el tag: `$element` es el comentario ancla de `transclude: "element"`. Se linkea
    // DENTRO del clon del `<ng-container>` y recién después se sube al lugar del ancla: AngularJS linkea los hijos por
    // su índice en `childNodes` del clon, así que sacarlos antes (en el `cloneAttachFn`) los dejaba sin linkear (un
    // `ng-repeat` de adentro recibía un `$element` vacío → "Cannot read properties of undefined (reading 'parent')").
    const clone = this.$transclude(this.$scope, (cloned) => {
      if (cloned) this.$element.after(cloned);
    });
    const wrapper = clone?.[0] as Node | undefined;
    if (!wrapper?.parentNode) return;
    this.content = clone.contents();
    for (const node of Array.from(this.content as ArrayLike<Node>)) wrapper.parentNode.insertBefore(node, wrapper);
    clone.remove();
  }

  $onDestroy(): void {
    this.viewContainerRef.clear();
    this.content?.remove();
  }

  static directive(): angular.IDirective {
    return { controller: NgContainer, restrict: "E", transclude: "element" };
  }
}
