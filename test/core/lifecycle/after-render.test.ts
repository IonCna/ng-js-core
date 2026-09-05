import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { afterNextRender, afterRender } from "@/core/lifecycle/after-render.ts";
import { PlatformRefImpl } from "@/platform/bootstrap.ts";

let moduleCounter = 0;
function uniqueModuleName(prefix: string): string {
  moduleCounter++;
  return `${prefix}${moduleCounter}`;
}

function mountHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

async function bootApp() {
  const host = mountHost();
  const name = uniqueModuleName("afterRenderTest");
  angular.module(name, []);

  const platform = new PlatformRefImpl();
  const appRef = await platform.bootstrapModule(name, { hostElement: host });
  return { appRef, platform };
}

describe("etapa 5 — afterRender / afterNextRender", () => {
  it("afterNextRender corre una sola vez, en el próximo render, y no de nuevo en los siguientes", async () => {
    const { appRef, platform } = await bootApp();

    let calls = 0;
    afterNextRender(() => {
      calls++;
    });

    appRef.tick();
    expect(calls).toBe(1);

    appRef.tick();
    appRef.tick();
    expect(calls).toBe(1);

    platform.destroy();
  });

  it("afterRender corre en cada render subsiguiente, indefinidamente", async () => {
    const { appRef, platform } = await bootApp();

    let calls = 0;
    afterRender(() => {
      calls++;
    });

    appRef.tick();
    appRef.tick();
    appRef.tick();
    expect(calls).toBe(3);

    platform.destroy();
  });

  it("destroy() desengancha el callback — deja de correr en renders futuros", async () => {
    const { appRef, platform } = await bootApp();

    let calls = 0;
    const ref = afterRender(() => {
      calls++;
    });

    appRef.tick();
    expect(calls).toBe(1);

    ref.destroy();
    appRef.tick();
    appRef.tick();
    expect(calls).toBe(1);

    platform.destroy();
  });

  it("varios afterRender/afterNextRender conviven sin pisarse", async () => {
    const { appRef, platform } = await bootApp();

    const order: string[] = [];
    afterRender(() => order.push("repeating"));
    afterNextRender(() => order.push("once"));

    appRef.tick();
    appRef.tick();

    expect(order).toEqual(["repeating", "once", "repeating"]);

    platform.destroy();
  });
});
