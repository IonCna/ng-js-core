// Orden: el shim de framework debe correr antes de angular-mocks.
import "./test-framework-shim";

// Debe cargar antes que cualquier clase decorada: instala Reflect.getMetadata.
import "reflect-metadata";

// AngularJS y su módulo de testing. angular.js deja `angular` en `window`;
// angular-mocks se engancha a ese global al evaluarse.
import angular from "angular";
import "angular-mocks";

if (typeof window !== "undefined") {
  window.angular = angular;
}
