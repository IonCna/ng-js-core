import angular from "angular";

import "../src/index";
import { DemoAppComponent } from "./app/demo-app.component";
import {
  ProjectionCardComponent,
  ProjectionRelayComponent,
  projectedTemplateDirective,
} from "./app/projection-card.component";

angular
  .module("ngjsCoreDemo", ["ng.common"])
  .component("demoApp", DemoAppComponent)
  .component("projectionCard", ProjectionCardComponent)
  .component("projectionRelay", ProjectionRelayComponent)
  .directive("projectedTemplate", projectedTemplateDirective);

angular.element(() => {
  angular.bootstrap(document, ["ngjsCoreDemo"]);
});
