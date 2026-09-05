import angular from "angular";
import { NgContainer } from "@/common/ng-container.ts";
import { NgContent } from "@/common/ng-content.ts";
import { NgTemplateOutlet } from "@/common/ng-template-outlet.ts";
import { CoreModule } from "@/core/core-module.ts";
import { TemplateRef } from "@/core/refs/template-ref.ts";

export const CommonModule = angular
  .module("ng.js.common", [CoreModule.name])
  .directive("ngContent", NgContent.$factory)
  .directive("ngContainer", NgContainer.$factory)
  .directive("ngTemplate", TemplateRef.$factory)
  .directive("ngTemplateOutlet", NgTemplateOutlet.$factory);
