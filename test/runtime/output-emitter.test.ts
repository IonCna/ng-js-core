import "reflect-metadata";
import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { Output } from "@/core/metadata/output.ts";
import { EventEmitter } from "@/event-emitter.ts";
import { bootstrapModuleRuntime } from "@/runtime/index.ts";

describe("ngjs-core/runtime — bridge de @Output(EventEmitter)", () => {
  it("`x.emit(v)` dispara la expresión `(x)` del padre con `$event = v`; `this.x` sigue siendo el emitter", async () => {
    const seen: unknown[] = [];

    @Component({ selector: "emit-child", controllerAs: "$", template: "<span>child</span>" })
    class Child {
      @Output() picked = new EventEmitter<string>();
      fire(value: string): void {
        this.picked.emit(value);
      }
    }

    @Component({
      selector: "emit-root",
      controllerAs: "$",
      template: '<emit-child picked="$.onPicked($event)"></emit-child>',
    })
    class Root {
      onPicked(value: unknown): void {
        seen.push(value);
      }
    }

    @NgModule({ declarations: [Root, Child] })
    class AppModule {}

    const host = document.createElement("emit-root");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });

    const childEl = host.querySelector("emit-child") as Element;
    const ctrl = angular.element(childEl).controller("emitChild") as Child;

    expect(ctrl.picked).toBeInstanceOf(EventEmitter);
    ctrl.fire("hello");
    expect(seen).toEqual(["hello"]);

    appRef.destroy();
  });

  it("sin expresión en el padre, `x.emit()` no explota", async () => {
    @Component({ selector: "emit-child2", controllerAs: "$", template: "<span>c</span>" })
    class Child {
      @Output() picked = new EventEmitter<void>();
    }
    @Component({ selector: "emit-root2", controllerAs: "$", template: "<emit-child2></emit-child2>" })
    class Root {}

    @NgModule({ declarations: [Root, Child] })
    class AppModule {}

    const host = document.createElement("emit-root2");
    document.body.appendChild(host);
    const appRef = await bootstrapModuleRuntime(AppModule, { hostElement: host });
    const childEl = host.querySelector("emit-child2") as Element;
    const ctrl = angular.element(childEl).controller("emitChild2") as Child;

    expect(() => ctrl.picked.emit()).not.toThrow();
    appRef.destroy();
  });
});
