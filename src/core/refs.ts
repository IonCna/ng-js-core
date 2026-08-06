import {
    type ContextObject,
    EmbeddedViewRef as AbstractViewRef,
    ViewContainerRef as AbstractViewContainerRef, type ViewRef
} from "@/core/abstracts"

import angular, {type IScope, type ITranscludeFunction} from "angular";
import type {ElementRef} from "@/core/index.ts";
import type {TemplateRef} from "@/common/ng-template.ts";

export class EmbeddedViewRef<C = ContextObject> extends AbstractViewRef<C> {
    public rootNodes: Node[] = [];

    private compiled: JQLite
    private _destroyed= false;
    private readonly onDestroyCallbacks = new Set<() => void>()

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

    public override onDestroy(callback: () => void): void {
        this.onDestroyCallbacks.add(callback)
    }

    public override detectChanges() {
        if(this._destroyed) return;
        this.$scope.$applyAsync()
    }

    public override destroy() {
        if(this.destroyed) return;

        this._destroyed = true
        this.compiled.remove()
        this.$scope.$destroy()
        for (const callback of this.onDestroyCallbacks) callback()
        this.onDestroyCallbacks.clear()
    }

    public override markForCheck() {
        if(this._destroyed) return;
        this.$scope.$evalAsync()
    }
}

export class ViewContainerRef extends AbstractViewContainerRef {
    private static readonly owners = new WeakMap<ViewRef, ViewContainerRef>()
    private readonly views: ViewRef[] = []
    private readonly trackedViews = new WeakSet<ViewRef>()

    constructor(public readonly element: ElementRef) {
        super()
    }

    public get length() {
        return this.views.length;
    }

    clear(): void {
        while (this.length) this.remove(this.length - 1)
    }

    createEmbeddedView<C>(templateRef: TemplateRef<C>, context?: C | undefined, options?: { index?: number | undefined } | undefined): EmbeddedViewRef<C>;
    createEmbeddedView<C>(templateRef: TemplateRef<C>, context?: C | undefined, index?: number | undefined): EmbeddedViewRef<C>;
    createEmbeddedView<C>(templateRef: TemplateRef<C>, context?: C, options?: { index?: number | undefined } | undefined | number): EmbeddedViewRef<C> {
        const viewRef = templateRef.createEmbeddedView(context ?? {} as C)

        const index = typeof options === "number" ? options : options?.index

        try {
            this.insert(viewRef, index)
        } catch (error) {
            viewRef.destroy()
            throw error
        }

        return viewRef
    }

    get(index: number): ViewRef | null {
        return this.views[index] ?? null;
    }

    indexOf(viewRef: ViewRef): number {
        return this.views.indexOf(viewRef);
    }

    insert(viewRef: ViewRef, index?: number): ViewRef {
        if (viewRef.destroyed) {
            throw new Error("No se puede insertar una vista destruida")
        }

        const currentOwner = ViewContainerRef.owners.get(viewRef)
        if (currentOwner) {
            const currentIndex = currentOwner.indexOf(viewRef)
            if (currentIndex !== -1) currentOwner.detach(currentIndex)
        }

        const targetIndex = this.normalizeInsertIndex(index)
        const anchor = this.element.nativeElement as Node
        const parent = anchor.parentNode

        if (!parent) {
            throw new Error("El ViewContainerRef no tiene un ancla conectada al DOM")
        }

        const referenceNode = this.getInsertionReference(targetIndex)
        const rootNodes = this.getRootNodes(viewRef)

        for (const node of rootNodes) parent.insertBefore(node, referenceNode)

        this.views.splice(targetIndex, 0, viewRef)
        ViewContainerRef.owners.set(viewRef, this)
        this.trackDestroyedView(viewRef)

        return viewRef
    }

    move(viewRef: ViewRef, currentIndex: number): ViewRef {
        if (this.indexOf(viewRef) === -1) {
            throw new Error("La vista no pertenece a este ViewContainerRef")
        }

        return this.insert(viewRef, currentIndex)
    }

    remove(index?: number): void {
        const viewRef = this.detach(index)
        viewRef?.destroy()
    }

    detach(index?: number): ViewRef | null {
        const targetIndex = index ?? this.length - 1
        if (targetIndex < 0 || targetIndex >= this.length) return null

        const [viewRef] = this.views.splice(targetIndex, 1)

        for (const node of this.getRootNodes(viewRef)) {
            node.parentNode?.removeChild(node)
        }

        if (ViewContainerRef.owners.get(viewRef) === this) {
            ViewContainerRef.owners.delete(viewRef)
        }

        return viewRef
    }

    private normalizeInsertIndex(index?: number): number {
        const targetIndex = index ?? this.length

        if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex > this.length) {
            throw new RangeError(`Índice de inserción fuera de rango: ${targetIndex}`)
        }

        return targetIndex
    }

    private getRootNodes(viewRef: ViewRef): Node[] {
        const rootNodes = (viewRef as Partial<EmbeddedViewRef>).rootNodes

        if (!rootNodes) {
            throw new Error("La vista no expone rootNodes y no puede insertarse")
        }

        return rootNodes as Node[]
    }

    private getInsertionReference(index: number): Node | null {
        for (let current = index; current < this.length; current++) {
            const [firstNode] = this.getRootNodes(this.views[current])
            if (firstNode) return firstNode
        }

        for (let current = index - 1; current >= 0; current--) {
            const rootNodes = this.getRootNodes(this.views[current])
            const lastNode = rootNodes[rootNodes.length - 1]
            if (lastNode) return lastNode.nextSibling
        }

        return (this.element.nativeElement as Node).nextSibling
    }

    private trackDestroyedView(viewRef: ViewRef) {
        if (this.trackedViews.has(viewRef)) return

        this.trackedViews.add(viewRef)
        viewRef.onDestroy(() => {
            const index = this.views.indexOf(viewRef)
            if (index !== -1) this.views.splice(index, 1)

            if (ViewContainerRef.owners.get(viewRef) === this) {
                ViewContainerRef.owners.delete(viewRef)
            }
        })
    }

}
