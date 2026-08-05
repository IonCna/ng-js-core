import type {IAugmentedJQuery, IController, IDirective, ITranscludeFunction} from "angular";

export class NgContent implements IController {
    constructor(
        private $element: IAugmentedJQuery,
        private $transclude?: ITranscludeFunction
    ) {}

    $postLink() {
        this.$transclude?.(clone => {
            if(!clone) return
            this.$element.after(clone)
        })

        this.$element.remove()
    }

    static get $inject() {
        return ["$element", "$transclude"];
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
