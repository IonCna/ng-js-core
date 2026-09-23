import { Component } from "@/core/metadata/component.ts";

/** Compartido entre la app (eager) y el chunk `lazy-env.module.ts`. */

/** Registro de `ngOnDestroy` (servicios lazy, clases `@NgModule`). */
export const destroyLog: string[] = [];

/** Registro de guards/resolvers/títulos: qué `Greeting` vieron vía `inject()`. */
export const routeLog: string[] = [];

export class Greeting {
  constructor(readonly text: string) {}
}

/** Componente eager: muestra el `Greeting` que le toque según dónde se renderiza. */
@Component({ selector: "greeting-label", controllerAs: "$ctrl", template: "<em>[{{ $ctrl.text }}]</em>" })
export class GreetingLabel {
  static readonly $inject = ["Greeting"];
  text: string;
  constructor(greeting: Greeting) {
    this.text = greeting.text;
  }
}
