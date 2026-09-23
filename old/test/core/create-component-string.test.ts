import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { createComponent } from "@/runtime/create-component.ts";

describe("createComponent por nombre AngularJS", () => {
  it("crea un componente ya registrado y respeta bindings @", async () => {
    class LegacyCard {
      label = "";
    }

    const name = "createComponentString";
    angular.module(name, []).component("legacyCard", {
      bindings: {
        label: "@",
      },
      controller: LegacyCard,
      template: "<span>{{$ctrl.label}}</span>",
    });

    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [name], { strictDi: false });
    const ref = await createComponent<LegacyCard>("legacyCard", {
      environmentInjector: injector,
      bindings: { label: "hola" },
    });

    host.appendChild(ref.location.nativeElement);
    ref.hostView.reattach();
    ref.changeDetectorRef.detectChanges();

    expect(ref.instance).toBeInstanceOf(LegacyCard);
    expect(host.querySelector("span")?.textContent).toBe("hola");
  });
});
