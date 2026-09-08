import type { IAugmentedJQuery, IController, IDirective, IScope, ITranscludeFunction } from "angular";
import {
  bindContentQueryOwners,
  getContentQueryOwners,
  getScopeViewQueryRegistries,
  runWithContentQueryOwners,
} from "@/core/queries/query-context.ts";
import { type ContentProjection, CONTENT_PROJECTION_KEY } from "@/runtime/bridges/content-projection-bridge.ts";

/**
 * `<ng-content>` pelado (sin `@Directive`).
 *
 * Con proyección EAGER (`content-projection-bridge.ts`) el contenido ya lo
 * transcluyó y linkeó el componente al construirse: acá solo se MUEVEN esos
 * nodos ya vivos a la posición del `<ng-content>`.
 *
 * Fallback (no debería pasar con un `@Component`, sí para usos sueltos): si no
 * hay proyección eager se cae al camino viejo — transcluir acá mismo, armando
 * el binding scope-transcluido → registry para `@ContentChild(ren)`.
 */
export class NgContent implements IController {
  static readonly $inject = ["$element", "$transclude", "$scope"];

  constructor(
    private readonly $element: IAugmentedJQuery,
    private readonly $transclude: ITranscludeFunction | undefined,
    private readonly $scope: IScope,
  ) {}

  $postLink(): void {
    const projection = this.$element.inheritedData(CONTENT_PROJECTION_KEY) as ContentProjection | undefined;

    if (projection && !projection.consumed) {
      projection.consumed = true;
      if (projection.clone) this.$element.after(projection.clone);
      this.$element.remove();
      return;
    }

    const localOwners = getScopeViewQueryRegistries(this.$scope).filter((registry) => registry.hasContentQueries);
    const inheritedOwners = getContentQueryOwners(this.$scope);
    const owners = Array.from(new Set([...localOwners, ...inheritedOwners]));

    runWithContentQueryOwners(owners, () => {
      this.$transclude?.((clone, transcludedScope) => {
        const rootNodes = clone ? (Array.from(clone) as Node[]) : [];
        for (const owner of owners) owner.registerContentRoots(rootNodes);
        if (transcludedScope) bindContentQueryOwners(transcludedScope, owners);
        if (!clone) return;
        this.$element.after(clone);
      });
    });

    this.$element.remove();
  }

  static $factory(): IDirective {
    return {
      controller: NgContent,
      restrict: "E",
    };
  }
}
