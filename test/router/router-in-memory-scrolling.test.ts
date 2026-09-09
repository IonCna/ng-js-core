import "reflect-metadata";
import "zone.js";
import type angular from "angular";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Component } from "@/core/metadata/component.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import type { Routes } from "@/router/index.ts";
import { Router, RouterModule, withInMemoryScrolling } from "@/router/index.ts";
import type { ViewportScroller } from "@/common/index.ts";
import { CommonModule } from "@/runtime/common/index.ts";
import { bootstrapApplication } from "@/runtime/index.ts";

@Component({ selector: "ims-root", template: "<ui-view></ui-view>" })
class ImsRoot {}
@Component({ selector: "ims-home", template: "<h1>home</h1>" })
class ImsHome {}
@Component({ selector: "ims-page", template: '<h1>page</h1><div id="sec">x</div>' })
class ImsPage {}

const routes: Routes = [
  { path: "", component: ImsHome },
  { path: "page", component: ImsPage },
];

let scrollToSpy: ReturnType<typeof vi.fn>;
let originalScrollTo: typeof window.scrollTo;
let currentAppRef: { destroy(): void } | undefined;

async function boot(feature?: ReturnType<typeof withInMemoryScrolling>) {
  @NgModule({
    imports: [CommonModule, RouterModule.forRoot(routes, ...(feature ? [feature] : []))],
    declarations: [ImsRoot, ImsHome, ImsPage],
  })
  class AppModule {}

  const host = document.createElement("ims-root");
  document.body.appendChild(host);
  const appRef = await bootstrapApplication(AppModule, { hostElement: host });
  currentAppRef = appRef;
  const injector = appRef.injector as angular.auto.IInjectorService;
  return {
    injector,
    router: injector.get<Router>(Router.$name),
    $rootScope: injector.get<angular.IRootScopeService>("$rootScope"),
  };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => {
  originalScrollTo = window.scrollTo;
  scrollToSpy = vi.fn();
  window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
});

afterEach(() => {
  window.scrollTo = originalScrollTo;
  currentAppRef?.destroy();
  currentAppRef = undefined;
  window.history.pushState(null, "", "/"); // aislar la URL entre tests del mismo archivo
});

describe("ngjs-core/router — withInMemoryScrolling", () => {
  it("scrollPositionRestoration: 'top' → scroll a [0,0] tras navegar", async () => {
    const { router, $rootScope } = await boot(withInMemoryScrolling({ scrollPositionRestoration: "top" }));
    scrollToSpy.mockClear();

    await router.navigateByUrl("/page");
    $rootScope.$digest();
    await tick();
    $rootScope.$digest();

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it("anchorScrolling: 'enabled' → scroll al elemento del #fragment (gana sobre top)", async () => {
    const { router, $rootScope } = await boot(
      withInMemoryScrolling({ scrollPositionRestoration: "top", anchorScrolling: "enabled" }),
    );
    scrollToSpy.mockClear();

    await router.navigateByUrl("/page#sec");
    $rootScope.$digest();
    // `#sec` ya está montado; stubbeamos su rect antes de que corra el `$timeout(0)`.
    const sec = document.getElementById("sec");
    expect(sec).not.toBeNull();
    if (sec) sec.getBoundingClientRect = () => ({ top: 120, left: 0 }) as DOMRect;
    await tick();
    $rootScope.$digest();

    expect(scrollToSpy).toHaveBeenCalledWith(0, 120);
  });

  it("scrollPositionRestoration: 'enabled' yendo adelante → scroll a [0,0]", async () => {
    const { router, $rootScope } = await boot(withInMemoryScrolling({ scrollPositionRestoration: "enabled" }));
    scrollToSpy.mockClear();

    await router.navigateByUrl("/page");
    $rootScope.$digest();
    await tick();
    $rootScope.$digest();

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it("scrollPositionRestoration: 'enabled' → restaura la posición guardada en un back/forward", async () => {
    const { router, $rootScope, injector } = await boot(
      withInMemoryScrolling({ scrollPositionRestoration: "enabled" }),
    );
    const vs = injector.get<ViewportScroller>("ViewportScroller");
    const nav = async (url: string) => {
      await router.navigateByUrl(url);
      $rootScope.$digest();
      await tick();
      $rootScope.$digest();
    };

    // en /page el usuario "scrollea" a y=300; después va a /
    await nav("/page");
    vi.spyOn(vs, "getScrollPosition").mockReturnValue([0, 300]);
    await nav("/"); // el onBefore guarda /page → [0,300]
    scrollToSpy.mockClear();

    // botón atrás → /page
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await nav("/page");

    expect(scrollToSpy).toHaveBeenCalledWith(0, 300);
    expect(scrollToSpy).not.toHaveBeenCalledWith(0, 0);
  });

  it("sin el feature → no toca el scroll", async () => {
    const { router, $rootScope } = await boot();
    scrollToSpy.mockClear();

    await router.navigateByUrl("/page");
    $rootScope.$digest();
    await tick();
    $rootScope.$digest();

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
