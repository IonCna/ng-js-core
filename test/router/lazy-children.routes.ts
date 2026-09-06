import { Component } from "@/core/metadata/component.ts";
import type { Routes } from "@/router/index.ts";

/** Fixture del spike de `lazyLoad` + ESM: este archivo es "el chunk lazy". */

@Component({ selector: "lazy-users", template: "<h2>lazy users page</h2>" })
export class LazyUsersPage {}

@Component({
  selector: "lazy-user-detail",
  controllerAs: "$ctrl",
  template: "<h2>detail {{ $ctrl.userId }}</h2>",
})
export class LazyUserDetailPage {
  static readonly $inject = ["$stateParams"];
  userId: string;
  constructor($stateParams: { id: string }) {
    this.userId = $stateParams.id;
  }
}

export const CHILD_ROUTES: Routes = [
  { path: "users", component: LazyUsersPage },
  { path: "users/:id", component: LazyUserDetailPage },
];
