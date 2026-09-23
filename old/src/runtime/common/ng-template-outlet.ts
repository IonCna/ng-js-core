import type { IAugmentedJQuery, IController, IDirective } from "angular";
import type { EmbeddedViewRefImpl } from "@/core/refs/embedded-view-ref.ts";
import type { TemplateRef } from "@/core/refs/template-ref.ts";

/**
 * `*ngTemplateOutlet` pelado (sin `@Directive`) — atributo con binding nativo
 * (`<`): cada cambio de `ngTemplateOutlet` destruye la vista anterior y crea una
 * nueva, sin depender de `viewChild`/`$postLink`.
 *
 * La vista embebida se linkea **en su posición real del DOM** (justo después del
 * ancla del outlet), no en un fragmento detached: así el contenido proyectado
 * resuelve la DI jerárquica de directivas (`inject(NgbDatepicker)`,
 * `providers: [...]` de un ancestro), `require: '^^'` e `inheritedData` — el
 * equivalente al `[ngTemplateOutletInjector]` de Angular, pero automático.
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

    const anchor = this.$element[0] as Node;
    const parent = anchor.parentNode;
    if (!parent) return;

    // Por referencia (sin copiar): así una mutación in-place del objeto de
    // contexto se ve en la vista, como en Angular. La vista se re-crea solo
    // cuando cambia la REFERENCIA del binding (`$onChanges` de `<`).
    const context = (this.ngTemplateOutletContext ?? {}) as C;
    this.embeddedView = this.ngTemplateOutlet.createEmbeddedView(context, undefined, {
      parent,
      anchor: anchor.nextSibling,
    });
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
