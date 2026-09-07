import type { IAttributes, IAugmentedJQuery, IDirective, IScope } from "angular";
import type { Subscription } from "rxjs";
import { FocusMonitor } from "@/cdk/a11y/focus-monitor.ts";
import { ElementRef } from "@/core/refs/element-ref.ts";

/**
 * `[cdkMonitorElementFocus]` / `[cdkMonitorSubtreeFocus]` — mismas directivas
 * que `@angular/cdk/a11y`. Monitorean el foco del host (o su subárbol) y evalúan
 * la expresión `cdkFocusChange` con `$event` = el `FocusOrigin`.
 */
export class CdkMonitorFocus {
  static readonly $inject = [ElementRef.$name, FocusMonitor.$name, "$scope", "$attrs"] as const;

  private subscription?: Subscription;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly monitor: FocusMonitor,
    private readonly $scope: IScope,
    private readonly $attrs: { cdkFocusChange?: string },
  ) {}

  /** Lo llama el `link` de la directiva con `false` (element) o `true` (subtree). */
  start(checkChildren: boolean): void {
    this.subscription = this.monitor.monitor(this.elementRef.nativeElement, checkChildren).subscribe((origin) => {
      const expr = this.$attrs.cdkFocusChange;
      if (expr) this.$scope.$applyAsync(() => this.$scope.$eval(expr, { $event: origin }));
    });
  }

  $onDestroy(): void {
    this.subscription?.unsubscribe();
    this.monitor.stopMonitoring(this.elementRef.nativeElement);
  }

  static factoryFor(checkChildren: boolean): () => IDirective {
    return () => ({
      restrict: "A",
      controller: CdkMonitorFocus,
      link: (_scope: IScope, _el: IAugmentedJQuery, _attrs: IAttributes, ctrl: unknown) => {
        (ctrl as CdkMonitorFocus | undefined)?.start(checkChildren);
      },
    });
  }
}
