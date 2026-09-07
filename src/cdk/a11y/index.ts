/**
 * `ngjs-core/a11y` — superficie de `@angular/cdk/a11y`: `LiveAnnouncer`,
 * `FocusTrap`/`FocusTrapFactory`, `FocusMonitor`, `InteractivityChecker`. Ver
 * `docs/ORDEN-DE-CONSTRUCCION.md` etapa 18 (a11y avanzada).
 *
 * Las directivas (`cdkAriaLive`/`cdkTrapFocus`/`cdkMonitorElementFocus`) y el
 * `A11yModule` viven en `ngjs-core/runtime/a11y`.
 */

export { FocusMonitor, type FocusOrigin } from "@/cdk/a11y/focus-monitor.ts";
export { FocusTrap, FocusTrapFactory } from "@/cdk/a11y/focus-trap.ts";
export {
  FOCUSABLE_SELECTOR,
  InteractivityChecker,
} from "@/cdk/a11y/interactivity-checker.ts";
export {
  type AriaLivePoliteness,
  LIVE_ANNOUNCER_DEFAULT_OPTIONS,
  LiveAnnouncer,
  type LiveAnnouncerDefaultOptions,
} from "@/cdk/a11y/live-announcer.ts";
