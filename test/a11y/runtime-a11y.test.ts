import angular from "angular";
import { describe, expect, it } from "vitest";
import {
  A11yModule,
  a11yModule,
  FocusMonitor,
  FocusTrapFactory,
  InteractivityChecker,
  LiveAnnouncer,
  provideA11y,
} from "@/runtime/a11y/index.ts";

function boot(mod: angular.IModule, html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const injector = angular.bootstrap(host, [mod.name], { strictDi: false });
  const $rootScope = injector.get<angular.IRootScopeService & Record<string, unknown>>("$rootScope");
  return { host, injector, $rootScope };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("etapa 18 (a11y) — ngjs-core/runtime/a11y", () => {
  it("A11yModule sin config es memoizado; provideA11y(config) da uno nuevo", () => {
    expect(a11yModule()).toBe(A11yModule);
    expect(provideA11y({ liveAnnouncer: { politeness: "assertive" } })).not.toBe(A11yModule);
    expect(A11yModule.requires).toEqual(["ng.js.core"]);
  });

  it("registra los 4 servicios", () => {
    const { injector } = boot(A11yModule, "<span></span>");
    expect(injector.get(LiveAnnouncer.$name)).toBeInstanceOf(LiveAnnouncer);
    expect(injector.get(InteractivityChecker.$name)).toBeInstanceOf(InteractivityChecker);
    expect(injector.get(FocusTrapFactory.$name)).toBeInstanceOf(FocusTrapFactory);
    expect(injector.get(FocusMonitor.$name)).toBeInstanceOf(FocusMonitor);
  });

  it("[cdkTrapFocus] crea el trap con anclas contra su host", async () => {
    const { host } = boot(A11yModule, `<div cdk-trap-focus><button>a</button><button>b</button></div>`);
    await flush();
    const trapped = host.querySelector("[cdk-trap-focus]") as HTMLElement;
    expect(trapped.previousElementSibling?.classList.contains("cdk-focus-trap-anchor")).toBe(true);
    expect(trapped.nextElementSibling?.classList.contains("cdk-focus-trap-anchor")).toBe(true);
  });

  it("[cdkAriaLive] anuncia cuando cambia el texto del host", async () => {
    const { $rootScope } = boot(A11yModule, `<div cdk-aria-live>{{ msg }}</div>`);
    $rootScope.msg = "";
    $rootScope.$digest();

    $rootScope.msg = "3 resultados";
    $rootScope.$digest();
    await flush();
    await new Promise((r) => setTimeout(r, 120)); // delay interno de LiveAnnouncer

    expect(document.querySelector(".cdk-live-announcer-element")?.textContent).toBe("3 resultados");
  });

  it("[cdkMonitorElementFocus] evalúa cdkFocusChange con $event", async () => {
    const { host, injector, $rootScope } = boot(
      A11yModule,
      `<button cdk-monitor-element-focus cdk-focus-change="onFocus($event)">x</button>`,
    );
    const origins: unknown[] = [];
    $rootScope.onFocus = (o: unknown) => origins.push(o);
    $rootScope.$digest();

    (host.querySelector("button") as HTMLButtonElement).focus();
    await flush();
    $rootScope.$digest();

    expect(origins).toContain("program");
    injector.get<angular.IRootScopeService>("$rootScope").$destroy();
  });
});
