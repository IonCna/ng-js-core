import "reflect-metadata";
import angular from "angular";
import { describe, expect, it } from "vitest";
import { AfterRenderEventManager } from "@/core/lifecycle/after-render-event-manager.ts";
import { ViewRefImpl } from "@/core/refs/view-ref.ts";
import { ApplicationRefImpl } from "@/core/platform/application-ref.ts";
import { NgZoneFactory } from "@/core/platform/digest-bridge.ts";

describe("ApplicationRef views", () => {
  it("attachView/detachView controlan ownership y viewCount", () => {
    const module = angular.module("applicationRefViews", []);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const injector = angular.bootstrap(host, [module.name], { strictDi: false });
    const rootScope = injector.get<angular.IRootScopeService>("$rootScope");
    const appRef = new ApplicationRefImpl(rootScope, injector, NgZoneFactory.create(), new AfterRenderEventManager());
    const view = new ViewRefImpl(rootScope.$new(), [document.createTextNode("view")]);

    appRef.attachView(view);
    expect(appRef.viewCount).toBe(1);

    appRef.detachView(view);
    expect(appRef.viewCount).toBe(0);

    appRef.attachView(view);
    view.destroy();
    expect(appRef.viewCount).toBe(0);
  });
});
