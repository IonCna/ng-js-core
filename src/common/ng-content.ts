import type {IAugmentedJQuery, IController, IDirective, IScope, ITranscludeFunction} from "angular";
import {
    bindContentQueryOwners,
    getScopeViewQueryRegistries,
    runWithContentQueryOwners,
} from "@/core/ng-controller";

export class NgContent implements IController {
    constructor(
        private $element: IAugmentedJQuery,
        private $transclude: ITranscludeFunction | undefined,
        private $scope: IScope,
    ) {}

    $postLink() {
        const owners = getScopeViewQueryRegistries(this.$scope).filter(
            (registry) => registry.hasContentQueries,
        );

        runWithContentQueryOwners(owners, () => {
            this.$transclude?.((clone, transcludedScope) => {
                if (transcludedScope) {
                    bindContentQueryOwners(transcludedScope, owners);
                }

                if (!clone) return;

                const nodes = Array.from(clone);
                for (const owner of owners) owner.setContentRoots(nodes);
                this.$element.after(clone);
            });
        });

        this.$element.remove()
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
        }
    }
}
