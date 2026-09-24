import type angular from "angular";
import { Inject } from "@/core/di/inject.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { findAncestorControl, publishControlContainer } from "@/forms/control-container.ts";

/**
 * `formArrayName` — resuelve un `FormArray` anidado por nombre contra el
 * `[formGroup]`/`formArrayName` ancestro más cercano, y se publica a sí mismo
 * como container: sus propios `formControlName` hijos resuelven por índice
 * en vez de por clave, sin que ninguno de los dos lados tenga que saber cuál
 * es cuál (`AbstractControl.get()` ya coerciona el segmento al tipo que
 * corresponda — ver `abstract-control.ts`: `FormGroup._find` hace
 * `String(segmento)`, `FormArray._find` hace `Number(segmento)`).
 */
@Directive({ selector: "[formArrayName]" })
export class FormArrayNameDirective {
  @Input({ binding: "@" }) formArrayName!: string;

  constructor(@Inject("$element") private readonly $element: angular.IAugmentedJQuery) {}

  $onInit(): void {
    const parent = findAncestorControl(this.$element);
    if (!parent) {
      throw new Error(`formArrayName="${this.formArrayName}": no hay ningún [formGroup]/formArrayName ancestro`);
    }
    const control = parent.get([this.formArrayName]);
    if (!control) {
      throw new Error(`formArrayName="${this.formArrayName}": no se encontró ese control en el ancestro`);
    }
    publishControlContainer(this.$element, control);
  }
}
