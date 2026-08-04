import angular from "angular";
import { decorateController } from "@/core/controller-decorator"

export type { EmbeddedViewRef } from "@/core/refs"
export { viewChild, type ViewChildOptions, type QuerySignal } from "@/core/viewChild"

export const CoreModule = angular.module("ng.core", [])
CoreModule.decorator("$controller", decorateController)