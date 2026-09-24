import type angular from "angular";
import { QueryContext } from "@/core/queries/query-context.ts";
import { CONTENT_PROJECTION_KEY, type ContentProjection } from "@/native/bridges/content-projection-bridge.ts";

/**
 * `<ng-content>`: donde va el contenido proyectado del componente que lo contiene (el que el compilador registró
 * con `transclude: true`). Si la proyección eager ya lo linkeó (`content-projection-bridge.ts`, cuando el componente
 * tiene queries de contenido) solo lo mueve acá; si no, lo transcluye él. Directiva nativa (`NativeModule`): usa el
 * `$transclude` del componente, que un `@Directive` compilado no pide.
 */
export class NgContent implements angular.IController {
  static readonly $inject = ["$element", "$transclude", "$scope"];

  constructor(
    private readonly $element: angular.IAugmentedJQuery,
    private readonly $transclude: angular.ITranscludeFunction | undefined,
    private readonly $scope: angular.IScope,
  ) {}

  $postLink(): void {
    const projection = this.$element.inheritedData(CONTENT_PROJECTION_KEY) as ContentProjection | undefined;
    if (projection && !projection.consumed) {
      projection.consumed = true;
      if (projection.clone) this.$element.after(projection.clone);
      this.$element.remove();
      return;
    }

    const localOwners = QueryContext.scopeRegistries(this.$scope).filter((registry) => registry.hasContentQueries);
    const owners = [...new Set([...localOwners, ...QueryContext.contentOwners(this.$scope)])];
    QueryContext.runWithContentOwners(owners, () => {
      this.$transclude?.((clone, transcludedScope) => {
        const rootNodes = clone ? (Array.from(clone) as Node[]) : [];
        for (const owner of owners) owner.registerContentRoots(rootNodes);
        if (transcludedScope) QueryContext.bindContentOwners(transcludedScope, owners);
        if (clone) this.$element.after(clone);
      });
    });
    this.$element.remove();
  }

  static directive(): angular.IDirective {
    return { controller: NgContent, restrict: "E" };
  }
}
