import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { Input } from "@/core/metadata/input.ts";
import { bootstrap, Component, Injectable } from "@/compat/index.ts";

describe("ngjs-core/compat — decoradores legacy", () => {
  it("@Injectable/@Component/@Input auto-registran y montan con DI por ctor", async () => {
    @Injectable()
    class Clock {
      now(): string {
        return "12:00";
      }
    }

    @Component({ selector: "compat-dec-child", controllerAs: "$", template: "<span>{{ $.label }}</span>" })
    class Child {
      @Input() label = "";
    }

    @Component({
      selector: "compat-dec-root",
      controllerAs: "$",
      template: '<compat-dec-child label="$.time"></compat-dec-child>',
    })
    class Root {
      time: string;
      constructor(clock: Clock) {
        this.time = clock.now();
      }
    }

    // `@Component` de compat auto-registra al decorar; las clases no se referencian aparte.
    void Child;
    void Root;

    const host = document.createElement("compat-dec-root");
    document.body.appendChild(host);
    const appRef = await bootstrap(host);
    (appRef.injector as angular.auto.IInjectorService).get<angular.IRootScopeService>("$rootScope").$digest();

    expect(host.querySelector("span")?.textContent).toBe("12:00");
    appRef.destroy();
  });
});
