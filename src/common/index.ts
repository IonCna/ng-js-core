import angular, {type IModule} from "angular"
import { NgTemplateRef } from "@/common/ng-template"
import { NgTemplateOutlet } from "@/common/ng-template-outlet"
import { NgContent } from "@/common/ng-content"

export const CommonModule: IModule = angular.module("ng.common", [])

CommonModule.directive(NgTemplateRef.$name, NgTemplateRef.$factory)
CommonModule.directive(NgTemplateOutlet.$name, NgTemplateOutlet.$factory)
CommonModule.directive(NgContent.$name, NgContent.$factory)
