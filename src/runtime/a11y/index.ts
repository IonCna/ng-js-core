/**
 * `ngjs-core/runtime/a11y` — el `angular.module` que registra los servicios de
 * `@angular/cdk/a11y` (`LiveAnnouncer`, `InteractivityChecker`, `FocusTrapFactory`,
 * `FocusMonitor`) y sus directivas (`cdkAriaLive`, `cdkTrapFocus`,
 * `cdkMonitorElementFocus`/`cdkMonitorSubtreeFocus`). Sin dependencias externas
 * — todo DOM. **Opt-in**.
 */
import angular from "angular";
import { FocusMonitor } from "@/a11y/focus-monitor.ts";
import { FocusTrapFactory } from "@/a11y/focus-trap.ts";
import { InteractivityChecker } from "@/a11y/interactivity-checker.ts";
import {
  LIVE_ANNOUNCER_DEFAULT_OPTIONS,
  LiveAnnouncer,
  type LiveAnnouncerDefaultOptions,
} from "@/a11y/live-announcer.ts";
import { CdkAriaLive } from "@/runtime/a11y/cdk-aria-live.ts";
import { CdkMonitorFocus } from "@/runtime/a11y/cdk-monitor-focus.ts";
import { CdkTrapFocus } from "@/runtime/a11y/cdk-trap-focus.ts";
import { installCoreModule } from "@/runtime/core-module.ts";

export * from "@/a11y/index.ts";
export { CdkAriaLive } from "@/runtime/a11y/cdk-aria-live.ts";
export { CdkMonitorFocus } from "@/runtime/a11y/cdk-monitor-focus.ts";
export { CdkTrapFocus } from "@/runtime/a11y/cdk-trap-focus.ts";

export interface A11yConfig {
  /** Defaults de `LiveAnnouncer` (`politeness`, `duration`). */
  liveAnnouncer?: LiveAnnouncerDefaultOptions;
}

let base: angular.IModule | undefined;
let seq = 0;

/**
 * Sin config: `angular.module("ng.js.a11y")` memoizado. Con config: uno nuevo
 * (`ngjs.a11y.N`), para poder pasar defaults distintos (como `RouterModule.forRoot`).
 */
export function a11yModule(config?: A11yConfig): angular.IModule {
  if (!config && base) return base;
  installCoreModule();

  const name = config ? `ngjs.a11y.${++seq}` : "ng.js.a11y";
  const mod = angular
    .module(name, ["ng.js.core"])
    .value(LIVE_ANNOUNCER_DEFAULT_OPTIONS.toString(), config?.liveAnnouncer ?? {})
    .service(LiveAnnouncer.$name, LiveAnnouncer)
    .service(InteractivityChecker.$name, InteractivityChecker)
    .service(FocusTrapFactory.$name, FocusTrapFactory)
    .service(FocusMonitor.$name, FocusMonitor)
    .directive("cdkAriaLive", CdkAriaLive.$factory)
    .directive("cdkTrapFocus", CdkTrapFocus.$factory)
    .directive("cdkMonitorElementFocus", CdkMonitorFocus.factoryFor(false))
    .directive("cdkMonitorSubtreeFocus", CdkMonitorFocus.factoryFor(true));

  if (!config) base = mod;
  return mod;
}

/** `angular.IModule` listo para `@NgModule({ imports: [A11yModule] })`. */
export const A11yModule: angular.IModule = a11yModule();

/** Equivalente funcional, con defaults opcionales. */
export function provideA11y(config?: A11yConfig): angular.IModule {
  return a11yModule(config);
}
