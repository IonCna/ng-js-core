import angular, {type IAugmentedJQuery, type IController, type IDirective} from "angular";
import { TemplateRef } from "@/common/ng-template";
import type {EmbeddedViewRef} from "@/core/refs";

export class NgTemplateOutlet<C> implements IController {
    private ngTemplateOutletContext?: C | null = null;
    private ngTemplateOutlet?: TemplateRef<C> | null = null;

    private _embedViewRef: EmbeddedViewRef<C> | undefined
    constructor(private $element: IAugmentedJQuery) {}

    $onChanges() {
        this._embedViewRef?.destroy()
        this._embedViewRef = undefined

        if (!this.ngTemplateOutlet) return;
        const context: C = angular.extend({}, this.ngTemplateOutletContext)

        this._embedViewRef = this.ngTemplateOutlet?.createEmbeddedView(context)
        this.$element.after(this._embedViewRef!.rootNodes)
    }

    $onDestroy() {
        this._embedViewRef?.destroy()
    }

    static get $inject() {
        return ["$element"]
    }

    static get $name() {
        return "ngTemplateOutlet";
    }

    static $factory(): IDirective {
        return {
            bindToController: {
                ngTemplateOutlet: "<",
                ngTemplateOutletContext: "<?"
            },
            scope: true,
            controller: NgTemplateOutlet,
            restrict: "A",
        }
    }
}
