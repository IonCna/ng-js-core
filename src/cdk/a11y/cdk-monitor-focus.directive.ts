import type { Subscription } from "rxjs";
import type { FocusMonitor, FocusOrigin } from "@/cdk/a11y/focus-monitor.ts";
import { EventEmitter } from "@/core/event-emitter.ts";
import type { AfterViewInit, OnDestroy } from "@/core/lifecycle/interfaces.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Output } from "@/core/metadata/output.ts";
import type { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `[cdkMonitorElementFocus]` / `[cdkMonitorSubtreeFocus]` — misma directiva que `@angular/cdk/a11y`. Monitorea el
 * foco del host (o de su subárbol) y emite `cdkFocusChange` con el `FocusOrigin` (`cdk-focus-change="fn($event)"`).
 */
@Directive({ selector: "[cdkMonitorElementFocus], [cdkMonitorSubtreeFocus]", exportAs: "cdkMonitorFocus" })
export class CdkMonitorFocus implements AfterViewInit, OnDestroy {
  @Output() cdkFocusChange = new EventEmitter<FocusOrigin>();

  private subscription?: Subscription;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly monitor: FocusMonitor,
  ) {}

  ngAfterViewInit(): void {
    const element = this.elementRef.nativeElement;
    const checkChildren = element.hasAttribute("cdk-monitor-subtree-focus");
    this.subscription = this.monitor
      .monitor(element, checkChildren)
      .subscribe((origin) => this.cdkFocusChange.emit(origin));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.monitor.stopMonitoring(this.elementRef.nativeElement);
  }
}
