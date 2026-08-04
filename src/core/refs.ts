import {
    type ContextObject,
    EmbeddedViewRef as AbstractViewRef,
    ViewContainerRef as AbstractViewContainerRef, ViewRef
} from "@/core/abstrct-refs"

import angular, {type IScope, type ITranscludeFunction} from "angular";
import type {ElementRef} from "@/core/index.ts";
import type {TemplateRef} from "@/common/ng-template.ts";

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

        const clone = $transclude(this.$scope, angular.noop)
        this.compiled = clone.contents()
        this.rootNodes = Array.from(this.compiled)

        for (const node of this.rootNodes) {
            node.parentNode?.removeChild(node)
        }

        clone.remove()
    }

    public override onDestroy(callback: Function): void {
        this.onDestroyCallback = callback;
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

export class ViewContainerRef extends AbstractViewContainerRef {
    readonly length: number;

    constructor(public readonly element: ElementRef) {
        super()
    }

    clear(): void {
    }

    createEmbeddedView<C>(templateRef: TemplateRef<C>, context?: C | undefined, options?: { index?: number | undefined } | undefined): EmbeddedViewRef<C>;
    createEmbeddedView<C>(templateRef: TemplateRef<C>, context?: C | undefined, index?: number | undefined): EmbeddedViewRef<C>;
    createEmbeddedView<C>(templateRef: TemplateRef<C>, context?: C, options?: { index?: number | undefined } | undefined | number): EmbeddedViewRef<C> {
        return undefined;
    }

    get(index: number): ViewRef | null {
        return undefined;
    }

    indexOf(viewRef: ViewRef): number {
        return 0;
    }

    insert(viewRef: ViewRef, index?: number | undefined): ViewRef {
        return undefined;
    }

    move(viewRef: ViewRef, currentIndex: number): ViewRef {
        return undefined;
    }

    remove(index?: number | undefined): void {
    }

}
