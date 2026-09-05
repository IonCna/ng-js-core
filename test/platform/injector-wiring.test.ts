import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { inject } from "@/core/di/inject.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";
import { Injector } from "@/core/di/injector.ts";
import type { Provider } from "@/core/di/provider.ts";
import { bootstrapApplication } from "@/core/platform/bootstrap.ts";

let counter = 0;
function uniqueComponentName(prefix: string): string {
  counter++;
  return `${prefix}${counter}`;
}

async function boot(providers: Provider[] = []) {
  const componentName = uniqueComponentName("wiringRoot");
  angular.module(`m-${componentName}`, []).component(componentName, { template: "ok" });

  const appRef = await bootstrapApplication(componentName, {
    modules: [`m-${componentName}`],
    providers,
  });

  const tag = componentName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const $injector = angular.element(document.querySelector(tag) as Element).injector();
  return { appRef, $injector };
}

describe("etapa 2 + 3 — Injector queda cableado por CoreModule (configureCore)", () => {
  it("Injector se puede pedir del $injector real de una app bootstrappeada", async () => {
    const { appRef, $injector } = await boot();

    const injector = $injector.get<Injector>(Injector.$name);
    expect(injector.get("$rootScope")).toBe($injector.get("$rootScope"));

    appRef.destroy();
  });

  it("inject() funciona después del bootstrap real, sin registrar nada a mano", async () => {
    const API_URL = new InjectionToken<string>("API_URL");
    const { appRef } = await boot([{ provide: API_URL, useValue: "https://example.test" }]);

    expect(inject("$rootScope")).toBeDefined();
    expect(inject(API_URL)).toBe("https://example.test");

    appRef.destroy();
  });

  it("con dos apps bootstrappeadas, inject() sigue apuntando a la última (no a una vieja)", async () => {
    const TOKEN_A = new InjectionToken<string>("TOKEN_A");
    const TOKEN_B = new InjectionToken<string>("TOKEN_B");

    const first = await boot([{ provide: TOKEN_A, useValue: "app-1" }]);
    const second = await boot([{ provide: TOKEN_B, useValue: "app-2" }]);

    expect(inject(TOKEN_B)).toBe("app-2");

    first.appRef.destroy();
    second.appRef.destroy();
  });
});
