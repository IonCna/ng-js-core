import type { AbstractControl } from "@/forms/abstract-control.ts";
import { FormGroup } from "@/forms/form-group.ts";

/**
 * Como `FormRecord` de Angular 14+: un `FormGroup` cuyas claves no se conocen de antemano (todas con el mismo tipo
 * de control). Mismo comportamiento que `FormGroup`; cambia el tipado.
 */
export class FormRecord<TControl extends AbstractControl = AbstractControl> extends FormGroup<Record<string, TControl>> {}
