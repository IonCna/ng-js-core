import type { IAugmentedJQuery, IController, IDirective, IScope, ITranscludeFunction } from "angular";
import {
  bindContentQueryOwners,
  getContentQueryOwners,
  getScopeViewQueryRegistries,
  runWithContentQueryOwners,
} from "@/core/decorators/ng-controller";

export class NgContent implements IController {
  constructor(
    private $element: IAugmentedJQuery,
    private $transclude: ITranscludeFunction | undefined,
    private $scope: IScope,
  ) {}

  $postLink() {
    const localOwners = getScopeViewQueryRegistries(this.$scope).filter((registry) => registry.hasContentQueries);
    const inheritedOwners = getContentQueryOwners(this.$scope);
    const owners = Array.from(new Set([...localOwners, ...inheritedOwners]));

    runWithContentQueryOwners(owners, () => {
      this.$transclude?.((clone, transcludedScope) => {
        if (transcludedScope) {
          bindContentQueryOwners(transcludedScope, owners);
        }

        if (!clone) return;

        const nodes = Array.from(clone);
        for (const owner of localOwners) owner.setContentRoots(nodes);
        this.$element.after(clone);
      });
    });

    this.$element.remove();
  }

  static get $inject() {
    return ["$element", "$transclude", "$scope"];
  }

  static get $name() {
    return "ngContent";
  }

  static $factory(): IDirective {
    return {
      controller: NgContent,
      restrict: "E",
    };
  }
}
