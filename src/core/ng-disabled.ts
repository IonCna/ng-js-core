import type angular from "angular";

/**
 * Puente reactivo hacia el estado `disabled` de un elemento — para que OTRA
 * directiva/componente en el mismo elemento pueda enterarse (`require:
 * '?ngDisabled'`) sin reimplementar el watch booleano. No reemplaza a
 * `ng-disabled` nativo: lo decora (`decorateNgDisabledDirective`) para que,
 * ADEMÁS de lo que ya hace (setear/sacar el atributo `disabled` según la
 * expresión), quede un controller ahí observando ese mismo atributo.
 */
export abstract class NgDisabled {
  static readonly $name = "ngDisabled";

  abstract readonly disabled: boolean;
  abstract onChange(callback: (disabled: boolean) => void): () => void;
}

export class NgDisabledImpl extends NgDisabled {
  private currentDisabled = false;
  private readonly listeners = new Set<(disabled: boolean) => void>();

  get disabled(): boolean {
    return this.currentDisabled;
  }

  onChange(callback: (disabled: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  setDisabled(disabled: boolean): void {
    if (disabled === this.currentDisabled) return;
    this.currentDisabled = disabled;

    for (const listener of this.listeners) listener(disabled);
  }
}

/**
 * Controller que `decorateNgDisabledDirective` le agrega a la directiva
 * `ngDisabled` nativa. Nativo ya hace `attr.$set('disabled', !!value)` según
 * la expresión de `ng-disabled="..."` — acá solo observamos el atributo
 * final resultante (`$attrs.$observe('disabled', ...)`), no reevaluamos la
 * expresión nosotros.
 */
export class NgDisabledController extends NgDisabled implements angular.IController {
  static readonly $inject = ["$attrs"];

  private readonly implementation = new NgDisabledImpl();

  constructor(private readonly $attrs: angular.IAttributes) {
    super();
  }

  $onInit(): void {
    // "disabled" es un BOOLEAN_ATTR nativo (ver angular.js) — AngularJS pasa
    // el booleano real acá, no el string del atributo; confirmado con un
    // probe real (loggeando el valor observado antes de asumir el tipo).
    this.$attrs.$observe<boolean | string | undefined>("disabled", (value) => {
      this.implementation.setDisabled(value === true || value === "disabled" || value === "true");
    });
  }

  get disabled(): boolean {
    return this.implementation.disabled;
  }

  onChange(callback: (disabled: boolean) => void): () => void {
    return this.implementation.onChange(callback);
  }
}

/** Le agrega `NgDisabledController` a cada directiva nativa registrada bajo "ngDisabled" (`BOOLEAN_ATTR`, no reemplaza nada de lo que ya hacen). */
export function decorateNgDisabledDirective($delegate: angular.IDirective[]): angular.IDirective[] {
  for (const directive of $delegate) {
    directive.controller = NgDisabledController;
  }
  return $delegate;
}
decorateNgDisabledDirective.$inject = ["$delegate"];
