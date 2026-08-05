import angular from "angular";
import { decorNgRef } from "@/core/ng-ref"
import { decorNgController } from "@/core/ng-controller"

export { EmbeddedViewRef, ViewContainerRef } from "@/core/refs"
export type { ContextObject } from "@/core/abstracts"

export const CoreModule = angular.module("ng.core", [])

CoreModule.decorator("$controller", decorNgController)
CoreModule.decorator("ngRefDirective", decorNgRef)

export class ElementRef<T = any> {
    public nativeElement: T;

    constructor(nativeElement: T) {
        this.nativeElement = nativeElement;
    }
}