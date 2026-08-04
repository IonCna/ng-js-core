import angular from "angular";
export type { EmbeddedViewRef } from "@/core/refs"

export const CoreModule = angular.module("ng.core", [])
//CoreModule.decorator("$controller", decorateController)