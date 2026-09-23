import type { SimpleChanges } from "@/core/lifecycle/interfaces.ts";

/**
 * El objeto que arma AngularJS para `$onChanges` trae `isFirstChange()` como
 * método (`IChangesObject` nativo) pero no la propiedad pública `firstChange`
 * de Angular real. Se la agrega acá — un getter perezoso sobre el mismo
 * método, sin duplicar el valor — mutando in-place el mismo objeto que
 * AngularJS ya arma (no hace falta clonar nada más).
 */
export function withFirstChangeProperty(changes: SimpleChanges): SimpleChanges {
  for (const change of Object.values(changes)) {
    if (!Object.hasOwn(change, "firstChange")) {
      Object.defineProperty(change, "firstChange", {
        configurable: true,
        enumerable: true,
        get(this: { isFirstChange(): boolean }) {
          return this.isFirstChange();
        },
      });
    }
  }
  return changes;
}
