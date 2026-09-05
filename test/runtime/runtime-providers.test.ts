import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { describe, expect, it } from "vitest";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

const API_URL = new InjectionToken<string>("API_URL");
const MULTI = new InjectionToken<string[]>("MULTI");

class Base {
  static readonly $name = "provBase";
  tag = "base";
}

describe("ngjs-core/runtime — recetas de provider", () => {
  it("useValue / useFactory / useExisting / multi resuelven tras bootstrapModuleRuntime", async () => {
    class Consumer {
      static readonly $inject = [API_URL.toString(), "provFromFactory", "provAlias", MULTI.toString()];
      constructor(
        readonly apiUrl: string,
        readonly fromFactory: string,
        readonly alias: Base,
        readonly multi: string[],
      ) {}
    }

    @Component({ selector: "prov-root", controllerAs: "$", template: "<span>{{ $.seen }}</span>" })
    class Root {
      static readonly $inject = ["provConsumer"];
      seen: string;
      constructor(consumer: Consumer) {
        this.seen = [consumer.apiUrl, consumer.fromFactory, consumer.alias.tag, consumer.multi.join("+")].join("|");
      }
    }

    @NgModule({
      declarations: [Root],
      providers: [
        Base,
        { provide: "provConsumer", useClass: Consumer },
        { provide: API_URL, useValue: "https://x.test" },
        { provide: "provFromFactory", useFactory: (url: string) => `f(${url})`, deps: [API_URL] },
        { provide: "provAlias", useExisting: Base },
        { provide: MULTI, useValue: "a", multi: true },
        { provide: MULTI, useValue: "b", multi: true },
      ],
    })
    class AppModule {}

    const host = document.createElement("prov-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    expect(host.querySelector("span")?.textContent).toBe("https://x.test|f(https://x.test)|base|a+b");
    appRef.destroy();
  });

  it("un feature module importado dos veces deja el provider como singleton", async () => {
    class Counter {
      static readonly $name = "provCounter";
      static instances = 0;
      constructor() {
        Counter.instances += 1;
      }
    }

    @NgModule({ providers: [Counter] })
    class FeatureModule {}

    @NgModule({ imports: [FeatureModule] })
    class MidA {}
    @NgModule({ imports: [FeatureModule] })
    class MidB {}

    @Component({ selector: "sing-root", template: "ok" })
    class Root {
      static readonly $inject = [Counter.$name];
      constructor(_c: Counter) {}
    }

    @NgModule({ imports: [MidA, MidB], declarations: [Root] })
    class AppModule {}

    Counter.instances = 0;
    const host = document.createElement("sing-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    (appRef.injector as angular.auto.IInjectorService).get(Counter.$name);
    expect(Counter.instances).toBe(1);
    appRef.destroy();
  });
});
