import angular from "angular";
import { beforeEach, describe, expect, it } from "vitest";
import { NgZone, NgZoneImpl } from "@/core/platform/ng-zone.ts";

describe("NgZone", () => {
  let $rootScope: angular.IRootScopeService;
  let zone: NgZoneImpl;
  let events: string[];

  beforeEach(() => {
    $rootScope = angular.injector(["ng"]).get("$rootScope");
    zone = new NgZoneImpl($rootScope);
    events = [];
    zone.onMicrotaskEmpty.subscribe(() => events.push("microtaskEmpty"));
    zone.onStable.subscribe(() => events.push("stable"));
  });

  it("emite onMicrotaskEmpty y onStable al terminar cada digest (un turno de la zona), una vez por digest", () => {
    $rootScope.$digest();
    expect(events).toEqual(["microtaskEmpty", "stable"]);

    $rootScope.$apply(() => $rootScope.$evalAsync(() => undefined));
    expect(events).toEqual(["microtaskEmpty", "stable", "microtaskEmpty", "stable"]);
  });

  it("run() dentro de un digest no agrega otro onStable; fuera de digest agenda uno", async () => {
    $rootScope.$apply(() => zone.run(() => undefined));
    expect(events).toEqual(["microtaskEmpty", "stable"]);

    events = [];
    zone.run(() => undefined);
    expect(events).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["microtaskEmpty", "stable"]);
  });

  it("onStable corre fuera de la zona (como Angular): lo que agenda un suscriptor no vuelve a disparar digest", () => {
    const inside: boolean[] = [];
    zone.onStable.subscribe(() => inside.push(NgZone.isInAngularZone()));
    zone.onMicrotaskEmpty.subscribe(() => inside.push(NgZone.isInAngularZone()));
    $rootScope.$digest();
    expect(inside).toEqual([true, false]);
    expect(NgZone.isInAngularZone()).toBe(true);
  });
});
