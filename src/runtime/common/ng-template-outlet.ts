import type { IAugmentedJQuery, IController, IDirective } from "angular";
import type { EmbeddedViewRefImpl } from "@/core/refs/embedded-view-ref.ts";
import type { TemplateRef } from "@/core/refs/template-ref.ts";

function insertAfter(anchor: Node, nodes: readonly Node[]): void {
  const parent = anchor.parentNode;
  if (!parent) return;
  const reference = anchor.nextSibling;
  for (const node of nodes) parent.insertBefore(node, reference);
}

/**
 * `*ngTemplateOutlet` pelado (sin `@Directive`) — atributo con binding nativo
 * (`<`): cada cambio de `ngTemplateOutlet` destruye la vista anterior y crea una
 * nueva, sin depender de `viewChild`/`$postLink`.
 */
export class NgTemplateOutlet<C = unknown> implements IController {
  static readonly $inject = ["$element"];

  ngTemplateOutlet?: TemplateRef<C> | null;
  ngTemplateOutletContext?: C | null;

  private embeddedView?: EmbeddedViewRefImpl<C>;

  constructor(private readonly $element: IAugmentedJQuery) {}

  $onChanges(): void {
    this.embeddedView?.destroy();
    this.embeddedView = undefined;

    if (!this.ngTemplateOutlet) return;

    const context = { ...(this.ngTemplateOutletContext ?? {}) } as C;
    this.embeddedView = this.ngTemplateOutlet.createEmbeddedView(context);
    insertAfter(this.$element[0] as Node, this.embeddedView.rootNodes);
  }

  $onDestroy(): void {
    this.embeddedView?.destroy();
  }

  static $factory(): IDirective {
    return {
      controller: NgTemplateOutlet,
      restrict: "A",
      scope: true,
      bindToController: {
        ngTemplateOutlet: "<",
        ngTemplateOutletContext: "<?",
      },
    };
  }
}
