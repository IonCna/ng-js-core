import angular from "angular";
import { ChangeDetectorRef as ChangeDetectorRefService } from "@/core/change-detector-ref";
import { decorNgController } from "@/core/ng-controller";
import { decorNgDisabled } from "@/core/ng-disabled";
import { decorNgRef } from "@/core/ng-ref";
import { NgZone, ngZoneFactory } from "@/core/ng-zone";

export { ContentChild, contentChild } from "@/core/contentChild";
export { ContentChildren, contentChildren } from "@/core/contentChildren";
export {
  ChangeDetectorRef,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  Refs,
  type ContextObject,
  ViewContainerRef,
  ViewRef,
} from "@/core/abstracts";
export { NgDisabled } from "@/core/ng-disabled";
export { QueryList } from "@/core/query-list";
export { ViewChild, viewChild } from "@/core/viewChild";
export { ViewChildren, viewChildren } from "@/core/viewChildren";
export { NgZone } from "@/core/ng-zone";

export const CoreModule = angular.module("ng.core", []);

CoreModule.decorator("$controller", decorNgController);
CoreModule.decorator("ngRefDirective", decorNgRef);
CoreModule.decorator("ngDisabledDirective", decorNgDisabled);

CoreModule.service(ChangeDetectorRefService.$name, ChangeDetectorRefService);
CoreModule.factory(NgZone.$name, ["$rootScope", ngZoneFactory]);

export interface Binding {
  readonly [BINDING: string]: unknown
}
