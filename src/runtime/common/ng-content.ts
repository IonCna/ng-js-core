import type { IAugmentedJQuery, IController, IDirective, IScope, ITranscludeFunction } from "angular";
import {
  bindContentQueryOwners,
  getContentQueryOwners,
  getScopeViewQueryRegistries,
  runWithContentQueryOwners,
} from "@/core/queries/query-context.ts";

/**
 * `<ng-content>` pelado (sin `@Directive`) — el único lugar donde se arma el
 * binding real scope-transcluido→registry que le faltaba a `@ContentChild`/
 * `@ContentChildren`: llama `$transclude` a mano para tener la referencia al
 * scope transcluido justo al crearse, y ahí lo bindea como "dueño de contenido"
 * de los registries de ESTE scope más los heredados (proyección multi-nivel).
 */
export class NgContent implements IController {
  static readonly $inject = ["$element", "$transclude", "$scope"];

  constructor(
    private readonly $element: IAugmentedJQuery,
    private readonly $transclude: ITranscludeFunction | undefined,
    private readonly $scope: IScope,
  ) {}

  $postLink(): void {
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
