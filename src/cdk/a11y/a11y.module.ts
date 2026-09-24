import { CdkAriaLive } from "@/cdk/a11y/cdk-aria-live.directive.ts";
import { CdkMonitorFocus } from "@/cdk/a11y/cdk-monitor-focus.directive.ts";
import { CdkTrapFocus } from "@/cdk/a11y/cdk-trap-focus.directive.ts";
import { LIVE_ANNOUNCER_DEFAULT_OPTIONS, type LiveAnnouncerDefaultOptions } from "@/cdk/a11y/live-announcer.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";

export interface A11yConfig {
  /** Defaults de `LiveAnnouncer` (`politeness`, `duration`). */
  liveAnnouncer?: LiveAnnouncerDefaultOptions;
}

/**
 * `A11yModule` de `@angular/cdk/a11y`: las directivas (`cdkAriaLive`, `cdkTrapFocus`, `cdkMonitor*Focus`). Los
 * servicios (`LiveAnnouncer`, `FocusMonitor`, `FocusTrapFactory`, `InteractivityChecker`) se proveen solos en la
 * raíz. `A11yModule.forRoot({ liveAnnouncer })` además fija los defaults de `LiveAnnouncer`.
 */
@NgModule({ declarations: [CdkAriaLive, CdkTrapFocus, CdkMonitorFocus] })
export class A11yModule {
  static forRoot(config: A11yConfig = {}): { ngModule: typeof A11yModule; providers: unknown[] } {
    return {
      ngModule: A11yModule,
      providers: [{ provide: LIVE_ANNOUNCER_DEFAULT_OPTIONS, useValue: config.liveAnnouncer ?? {} }],
    };
  }
}
