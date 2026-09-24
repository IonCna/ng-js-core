// Solo el proyecto "unit" (jsdom). Orden: el shim de framework debe correr antes de angular-mocks.
import "./test-framework-shim";

// AngularJS y su módulo de testing. angular.js deja `angular` en `window`; angular-mocks se engancha a ese global.
import angular from "angular";
import "angular-mocks";

if (typeof window !== "undefined") {
  window.angular = angular;
}
