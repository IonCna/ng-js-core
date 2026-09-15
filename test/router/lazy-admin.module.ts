import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { RouterModule } from "@/router/index.ts";

/** Fixture de `loadChildren` → clase `@NgModule`: este archivo es "el chunk lazy". */

export class AdminGreeter {
  greet(): string {
    return "hola admin";
  }
}

@Component({ selector: "admin-badge", template: "<span>badge</span>" })
export class AdminBadge {}

@Component({
  selector: "admin-dashboard",
  controllerAs: "$ctrl",
  template: "<h2>{{ $ctrl.message }}</h2><admin-badge></admin-badge>",
})
export class AdminDashboard {
  static readonly $inject = ["AdminGreeter"];
  message: string;
  constructor(greeter: AdminGreeter) {
    this.message = greeter.greet();
  }
}

@Component({
  selector: "admin-user",
  controllerAs: "$ctrl",
  template: "<h2>admin user {{ $ctrl.id }}</h2>",
})
export class AdminUser {
  static readonly $inject = ["$stateParams"];
  id: string;
  constructor($stateParams: { id: string }) {
    this.id = $stateParams.id;
  }
}

const ADMIN_ROUTES: Routes = [
  { path: "", component: AdminDashboard, title: "Admin" },
  { path: "users/:id", component: AdminUser },
];

@NgModule({
  imports: [RouterModule.forChild(ADMIN_ROUTES)],
  declarations: [AdminDashboard, AdminBadge, AdminUser],
  providers: [{ provide: "AdminGreeter", useClass: AdminGreeter }],
})
export class AdminModule {}
