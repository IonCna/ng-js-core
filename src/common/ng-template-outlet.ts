import type { OnChanges, OnDestroy } from "@/core/lifecycle/interfaces.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import type { ElementRef } from "@/core/refs/element-ref.ts";
import type { EmbeddedViewRef } from "@/core/refs/embedded-view-ref.ts";
import type { TemplateRef } from "@/core/refs/template-ref.ts";

/**
 * `[ngTemplateOutlet]="tpl"` (`ng-template-outlet="tpl"` en el template AngularJS): instancia el `TemplateRef`
 * justo después de este elemento, con `ngTemplateOutletContext` como contexto (`let-x` del template). Se recrea
 * cuando cambia el template o el contexto.
 */
@Directive({ selector: "[ngTemplateOutlet]" })
export class NgTemplateOutlet implements OnChanges, OnDestroy {
  @Input() ngTemplateOutlet?: TemplateRef<unknown> | null;
  @Input() ngTemplateOutletContext?: unknown;

  private view?: EmbeddedViewRef<unknown>;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngOnChanges(): void {
    this.view?.destroy();
    this.view = undefined;
    if (!this.ngTemplateOutlet) return;

    const anchor = this.elementRef.nativeElement;
    const parent = anchor.parentNode;
    if (!parent) return;
    this.view = this.ngTemplateOutlet.createEmbeddedView(this.ngTemplateOutletContext ?? {}, undefined, {
      parent,
      anchor: anchor.nextSibling,
    });
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }
}
