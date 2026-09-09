import { Component } from "@/core/metadata/component.ts";

// SIN `controllerAs` — el template usa `$.`, así que depende de heredarlo del
// `@NgModule` que importa el RouterModule (fallback de `routerRegistry`).
@Component({ selector: "lazy-cas", template: "<span>{{ $.msg }}</span>" })
export class LazyCas {
  msg = "cas-ok";
}

export default LazyCas;
