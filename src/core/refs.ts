import {type ContextObject, EmbeddedViewRef as AbstractViewRef} from "@/core/abstrct-refs"
import angular, {type IScope, type ITranscludeFunction} from "angular";

export class EmbeddedViewRef<C = ContextObject> extends AbstractViewRef<C> {
    public rootNodes: any[] = [];

    private compiled: JQLite
    private _destroyed= false;
    private onDestroyCallback?: Function

    public get destroyed() {
        return this._destroyed;
    }

    constructor(
        public context: C,
        private $scope: IScope,
        $transclude: ITranscludeFunction
    ) {
        super();

        this.compiled = $transclude(this.$scope, angular.noop)
        this.rootNodes = Array.from(this.compiled)
    }

    public override onDestroy(callback: Function): void {
        this.onDestroyCallback = callback;
    }

    public override detach(): void {
        throw new Error("Method not implemented.");
    }

    public override reattach(): void {
        throw new Error("Method not implemented.");
    }

    public override detectChanges() {
        if(this._destroyed) return;
        this.$scope.$digest()
    }

    public override destroy() {
        if(this.destroyed) return;

        this._destroyed = true
        this.compiled.remove()
        this.$scope.$destroy()
        this.onDestroyCallback?.()
    }

    public override markForCheck() {
        if(this._destroyed) return;
        this.$scope.$evalAsync()
    }
}