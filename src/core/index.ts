import angular from "angular";
import { ChangeDetectorRef } from "@/core/change-detector-ref";
import { decorNgController } from "@/core/ng-controller";
import { decorNgRef } from "@/core/ng-ref";
import { NgZone, ngZoneFactory } from "@/core/ng-zone";

export type { ContextObject } from "@/core/abstracts";
export { ChangeDetectorRef } from "@/core/change-detector-ref";
export { ContentChild, contentChild } from "@/core/contentChild";
export { ContentChildren, contentChildren } from "@/core/contentChildren";
export { NgZone } from "@/core/ng-zone";
export { QueryList } from "@/core/query-list";
export { EmbeddedViewRef, ViewContainerRef } from "@/core/refs";
export { ViewChild, viewChild } from "@/core/viewChild";
export { ViewChildren, viewChildren } from "@/core/viewChildren";

export const CoreModule = angular.module("ng.core", []);

CoreModule.decorator("$controller", decorNgController);
CoreModule.decorator("ngRefDirective", decorNgRef);
CoreModule.service(ChangeDetectorRef.$name, ChangeDetectorRef);
CoreModule.factory(NgZone.$name, ["$rootScope", ngZoneFactory]);

export class ElementRef<T = any> {
  public nativeElement: T;

  constructor(nativeElement: T) {
    this.nativeElement = nativeElement;
  }
}
