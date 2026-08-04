import angular from "angular";
import { decorNgRef } from "@/core/ng-ref"

export { EmbeddedViewRef } from "@/core/refs"
export type { ContextObject } from "@/core/abstrct-refs"

export const CoreModule = angular.module("ng.core", [])
//CoreModule.decorator("$controller", decorateController)
CoreModule.decorator("ngRefDirective", decorNgRef)

export class ElementRef<T = any> {
    public nativeElement: T;

    constructor(nativeElement: T) {
        this.nativeElement = nativeElement;
    }
}