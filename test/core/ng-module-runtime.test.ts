import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Injectable } from "@/core/di/injectable.ts";
import { Component } from "@/core/metadata/component.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { NgModule, ngModule } from "@/core/metadata/ng-module.ts";
import { Output } from "@/core/metadata/output.ts";
import { registerNgModule } from "@/runtime/ng-module-runtime.ts";

let counter = 0;
function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

describe("registerNgModule", () => {
  it("registra imports y providers", () => {
    @Injectable()
    class Service {
      static readonly $name = uniqueName("Service");
      value = "ok";
    }

    @NgModule({ id: uniqueName("runtimeProviders"), providers: [Service] })
    class FeatureModule {}

    @NgModule({ id: uniqueName("runtimeImports"), imports: [FeatureModule] })
    class AppModule {}

    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });

    expect(injector.get<Service>(Service.$name).value).toBe("ok");
  });

  it("acepta imports legacy de AngularJS al registrar un @NgModule", () => {
    const legacy = angular.module(uniqueName("legacyImport"), []);
    legacy.value("legacyValue", "ok");

    @NgModule({ id: uniqueName("runtimeLegacyImports"), imports: [legacy] })
    class AppModule {}

    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });

    expect(injector.get<string>("legacyValue")).toBe("ok");
  });

  it("registra componentes declarados por metadata", () => {
    class Card {
      @Input() label = "";
    }
    Component({ selector: "test-card", template: "<span>{{$ctrl.label}}</span>" })(Card);

    @NgModule({ id: uniqueName("runtimeComponent"), declarations: [Card] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = '<test-card label="label"></test-card>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });
    const scope = angular.element(host).scope() as angular.IScope & { label: string };
    scope.label = "hello";
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.querySelector("span")?.textContent).toBe("hello");
  });

  it("@Input/@Output derivan bindings AngularJS opcionales por default", () => {
    class Alert {
      @Input() type = "";

      @Output() closed?: () => void;
    }
    Component({
      selector: "compat-alert",
      template: '<span>{{$.type}}</span><button ng-click="$.closed()">x</button><div ng-transclude></div>',
      transclude: true,
      controllerAs: "$",
    })(Alert);

    @NgModule({ id: uniqueName("runtimeComponentOptions"), declarations: [Alert] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = '<compat-alert type="alertType" closed="closed = true">body</compat-alert>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });
    const scope = angular.element(host).scope() as angular.IScope & { alertType: string; closed: boolean };
    scope.alertType = "warning";
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    const button = host.querySelector("button") as HTMLButtonElement;
    button.click();

    expect(host.querySelector("span")?.textContent).toBe("warning");
    expect(host.querySelector("compat-alert")?.textContent).toContain("body");
    expect(scope.closed).toBe(true);
  });

  it("@Input con alias mapea la propiedad del controller al atributo aliasado", () => {
    class Aliased {
      @Input("data") items = "none";
    }
    Component({ selector: "aliased-box", template: "<span>{{$ctrl.items}}</span>" })(Aliased);

    @NgModule({ id: uniqueName("runtimeAlias"), declarations: [Aliased] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = '<aliased-box data="value"></aliased-box>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });
    const scope = angular.element(host).scope() as angular.IScope & { value: string };
    scope.value = "loaded";
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.querySelector("span")?.textContent).toBe("loaded");
  });

  it("registra directivas declaradas con factory JS", () => {
    @Directive({ selector: "[marker]" })
    class Marker {
      touched = true;

      static $factory(): angular.IDirective {
        return {
          restrict: "A",
          controller: Marker,
        };
      }
    }

    class AppModule {}
    ngModule(AppModule).define({ id: uniqueName("runtimeDirective"), declarations: [Marker] });

    const host = document.createElement("div");
    host.innerHTML = "<div marker></div>";
    document.body.appendChild(host);
    angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });

    const ctrl = angular.element(host.querySelector("[marker]") as Element).controller("marker") as Marker;
    expect(ctrl.touched).toBe(true);
  });

  it("@Directive puede declarar opciones AngularJS sin $factory", () => {
    @Directive({
      selector: "[child-dir]",
      restrict: "A",
      scope: {
        label: "@childDir",
      },
      bindToController: true,
      require: {
        parent: "^parentDir",
      },
      controllerAs: "$",
      template: "<span>{{$.label}}:{{$.parent.value}}</span>",
    })
    class ChildDir {
      label = "";
      parent!: ParentDir;
    }

    @Directive({
      selector: "[parent-dir]",
      restrict: "A",
    })
    class ParentDir {
      value = "parent";
    }

    @NgModule({ id: uniqueName("runtimeDirectiveOptions"), declarations: [ParentDir, ChildDir] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = '<div parent-dir><div child-dir="child"></div></div>';
    document.body.appendChild(host);
    angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });

    expect(host.querySelector("span")?.textContent).toBe("child:parent");
  });

  it("@Input/@Output también generan bindings AngularJS para directivas, no solo para componentes", () => {
    @Directive({ selector: "[navValue]" })
    class NavValueDirective {
      @Input("navValue") value = "";
      @Output() changed?: (locals: { $event: string }) => void;

      fire(): void {
        this.changed?.({ $event: this.value });
      }
    }

    @NgModule({ id: uniqueName("runtimeDirectiveBindings"), declarations: [NavValueDirective] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = '<div nav-value="source" changed="received = $event"></div>';
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });
    const scope = angular.element(host).scope() as angular.IScope & { source: string; received?: string };
    scope.source = "hola";
    injector.get<angular.IRootScopeService>("$rootScope").$digest();

    const ctrl = angular
      .element(host.querySelector("[nav-value]") as Element)
      .controller("navValue") as NavValueDirective;
    expect(ctrl.value).toBe("hola");

    ctrl.fire();
    expect(scope.received).toBe("hola");
  });

  it("@Component con selector de atributo ([navOutlet]) se registra como directiva de atributo, no de elemento", () => {
    @Component({ selector: "[navOutlet]", template: "<span>outlet</span>" })
    class NavOutlet {}

    @NgModule({ id: uniqueName("runtimeAttributeComponent"), declarations: [NavOutlet] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = "<div nav-outlet></div>";
    document.body.appendChild(host);
    angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });

    expect(host.querySelector("[nav-outlet] span")?.textContent).toBe("outlet");
  });

  it("selector compuesto (button[navLink]): el link custom solo corre en el tag que matchea", () => {
    let linked = 0;

    @Directive({
      selector: "button[navLink]",
      link: () => {
        linked++;
      },
    })
    class NavLink {}

    @NgModule({ id: uniqueName("runtimeCompoundSelector"), declarations: [NavLink] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = "<button nav-link></button><div nav-link></div>";
    document.body.appendChild(host);
    angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });

    expect(linked).toBe(1);
  });

  it("selector compuesto: límite conocido de AngularJS — el controller igual se instancia en el tag que no matchea, solo el link se filtra", () => {
    let constructed = 0;

    @Directive({ selector: "button[navLink2]" })
    class NavLink2 {
      constructor() {
        constructed++;
      }
    }

    @NgModule({ id: uniqueName("runtimeCompoundSelectorLimit"), declarations: [NavLink2] })
    class AppModule {}

    const host = document.createElement("div");
    host.innerHTML = "<button nav-link2></button><div nav-link2></div>";
    document.body.appendChild(host);
    angular.bootstrap(host, [registerNgModule(AppModule).name], { strictDi: false });

    // AngularJS matchea directivas por nombre+restrict solamente, no por selector
    // completo — instancia el controller en los dos elementos aunque el `div` no
    // matchee `button[navLink2]`. Es un límite real de AngularJS, no de esta lib.
    expect(constructed).toBe(2);
  });

  it("@NgModule solo estampa: no crea el angular.module hasta registerNgModule", () => {
    const id = uniqueName("runtimePending");

    @NgModule({ id })
    class AppModule {}

    expect((AppModule as unknown as { $name: string }).$name).toBe(id);
    expect(() => angular.module(id)).toThrow();

    expect(registerNgModule(AppModule).name).toBe(id);
    expect(angular.module(id).name).toBe(id);
  });

  it("deriva el nombre del angular.module de la clase cuando no se pasa id", () => {
    class DerivedNameModule {}
    ngModule(DerivedNameModule).define({});

    expect((DerivedNameModule as unknown as { $name: string }).$name).toBe("DerivedNameModule");
    expect(registerNgModule(DerivedNameModule).name).toBe("DerivedNameModule");
  });

  it("registerNgModule es idempotente: mismo angular.module, sin re-registrar", () => {
    @NgModule({ id: uniqueName("runtimeIdempotent") })
    class AppModule {}

    expect(registerNgModule(AppModule)).toBe(registerNgModule(AppModule));
  });
});
