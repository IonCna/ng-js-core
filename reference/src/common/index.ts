import angular, { type IModule } from "angular";
import { ContentRef } from "@/common/ng-container";
import { NgContent } from "@/common/ng-content";
import { TemplateRef } from "@/common/ng-template";
import { NgTemplateOutlet } from "@/common/ng-template-outlet";

import { CoreModule } from "@/core";

export const CommonModule: IModule = angular.module("ng.common", [CoreModule.name]);

CommonModule.directive(TemplateRef.$name, TemplateRef.$factory);
CommonModule.directive(NgTemplateOutlet.$name, NgTemplateOutlet.$factory);
CommonModule.directive(NgContent.$name, NgContent.$factory);
CommonModule.directive(ContentRef.$name, ContentRef.$factory);

export { NgContent, NgTemplateOutlet, TemplateRef };
