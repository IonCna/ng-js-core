import angular from "angular";
import { decorNgController, decorNgDisabled, decorNgRef, NgChangeDetectorRef } from "@/core/decorators";
import { NgZone, ngZoneFactory } from "@/core/ng-zone";

export {
  ChangeDetectorRef,
  ComponentRef,
  type ContextObject,
  ElementRef,
  EmbeddedViewRef,
  NgDisabled,
  Refs,
  ViewContainerRef,
  ViewRef,
} from "@/core/abstractions";
export { ContentChild, contentChild } from "@/core/contentChild";
export { ContentChildren, contentChildren } from "@/core/contentChildren";
export { NgZone } from "@/core/ng-zone";
export { QueryList } from "@/core/query-list";
export { ViewChild, viewChild } from "@/core/viewChild";
export { ViewChildren, viewChildren } from "@/core/viewChildren";

export const CoreModule = angular.module("ng.core", []);

CoreModule.decorator("$controller", decorNgController);
CoreModule.decorator("ngRefDirective", decorNgRef);
CoreModule.decorator("ngDisabledDirective", decorNgDisabled);

CoreModule.service(NgChangeDetectorRef.$name, NgChangeDetectorRef);
CoreModule.factory(NgZone.$name, ["$rootScope", ngZoneFactory]);

export interface Binding {
  readonly [BINDING: string]: unknown;
}
