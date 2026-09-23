import "zone.js";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { afterEveryRender, afterNextRender, afterRender } from "@/core/lifecycle/after-render.ts";
import { InjectorImpl } from "@/core/di/injector.ts";
import { PlatformRefImpl } from "@/core/platform/bootstrap.ts";

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

  it("afterEveryRender es el reemplazo moderno de afterRender — mismo comportamiento", async () => {
    const { appRef, platform } = await bootApp();

    let calls = 0;
    afterEveryRender(() => {
      calls++;
    });

    appRef.tick();
    appRef.tick();
    expect(calls).toBe(2);

    platform.destroy();
  });

  it("afterRender (deprecado) sigue andando — delega en afterEveryRender", async () => {
    const { appRef, platform } = await bootApp();

    let calls = 0;
    afterRender(() => {
      calls++;
    });

    appRef.tick();
    expect(calls).toBe(1);

    platform.destroy();
  });

  it("las fases corren en orden global: todos los earlyRead antes que cualquier write, etc.", async () => {
    const { appRef, platform } = await bootApp();

    const order: string[] = [];
    afterEveryRender({
      write: () => order.push("write-A"),
      read: () => order.push("read-A"),
    });
    afterEveryRender({
      earlyRead: () => order.push("earlyRead-B"),
      mixedReadWrite: () => order.push("mixedReadWrite-B"),
    });

    appRef.tick();

    expect(order).toEqual(["earlyRead-B", "write-A", "mixedReadWrite-B", "read-A"]);

    platform.destroy();
  });

  it("un callback plano equivale a { mixedReadWrite }", async () => {
    const { appRef, platform } = await bootApp();

    const order: string[] = [];
    afterEveryRender({ earlyRead: () => order.push("earlyRead") });
    afterEveryRender(() => order.push("plain"));
    afterEveryRender({ read: () => order.push("read") });

    appRef.tick();

    expect(order).toEqual(["earlyRead", "plain", "read"]);

    platform.destroy();
  });

  it("afterNextRender con varias fases: corren todas en el mismo render antes de desenganchar", async () => {
    const { appRef, platform } = await bootApp();

    const order: string[] = [];
    afterNextRender({
      earlyRead: () => order.push("earlyRead"),
      read: () => order.push("read"),
    });

    appRef.tick();
    expect(order).toEqual(["earlyRead", "read"]);

    appRef.tick();
    expect(order).toEqual(["earlyRead", "read"]); // no corrió de nuevo

    platform.destroy();
  });

  it("{ injector } explícito resuelve el AfterRenderEventManager de ESE injector, sin depender del contexto ambiente", async () => {
    const { appRef, platform } = await bootApp();
    const injector = InjectorImpl.current!;

    let calls = 0;
    afterEveryRender(() => calls++, { injector });

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

  it("un afterEveryRender que agenda un microtask NO dispara un loop de tick (freeze del navegador)", async () => {
    const { appRef, platform } = await bootApp();
    // biome-ignore lint/suspicious/noExplicitAny: la NgZone se resuelve por token string
    const ngZone = (appRef.injector as any).get("NgZone") as {
      run: (fn: () => void) => void;
    };

    let renders = 0;
    // simula `popperInstance.update()` de Popper v2: agenda una Promise (microtask).
    // Si `notify()` corre DENTRO de la zona, ese microtask re-dispara
    // `onMicrotaskEmpty` → `tick()` → `notify()` → ... loop.
    // El `< 100` evita colgar el test si el fix regresa: cortamos a mano.
    afterEveryRender(() => {
      renders++;
      if (renders < 100) Promise.resolve().then(() => {});
    });

    ngZone.run(() => {}); // un tick real, vía la zona (como en runtime)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // con el fix: 1–2 renders (uno por digest real). Sin el fix: llega a 100.
    expect(renders).toBeLessThan(10);

    platform.destroy();
  });
});
