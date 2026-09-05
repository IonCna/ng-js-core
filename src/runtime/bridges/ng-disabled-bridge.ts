import type angular from "angular";
import { NgDisabled } from "@/core/ng-disabled.ts";

/**
 * Implementación y wiring de `NgDisabled` sobre la directiva nativa `ngDisabled`.
 * `decorateNgDisabledDirective` le agrega `NgDisabledController` a la directiva
 * nativa (que ya hace `attr.$set('disabled', !!value)`); acá solo observamos el
 * atributo final resultante, no reevaluamos la expresión `ng-disabled="..."`.
 */
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

/** Le agrega `NgDisabledController` a cada directiva nativa registrada bajo "ngDisabled". */
export function decorateNgDisabledDirective($delegate: angular.IDirective[]): angular.IDirective[] {
  for (const directive of $delegate) {
    directive.controller = NgDisabledController;
  }
  return $delegate;
}
decorateNgDisabledDirective.$inject = ["$delegate"];
