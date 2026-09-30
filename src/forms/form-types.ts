import { FormArray } from "@/forms/form-array.ts";
import { FormBuilder } from "@/forms/form-builder.ts";
import { FormControl } from "@/forms/form-control.ts";
import { FormGroup } from "@/forms/form-group.ts";
import { FormRecord } from "@/forms/form-record.ts";

/** `isFormControl`/`isFormGroup`/`isFormArray`/`isFormRecord` de `@angular/forms`. */
export const isFormControl = (control: unknown): control is FormControl => control instanceof FormControl;

export const isFormGroup = (control: unknown): control is FormGroup => control instanceof FormGroup;

export const isFormArray = (control: unknown): control is FormArray => control instanceof FormArray;

export const isFormRecord = (control: unknown): control is FormRecord => control instanceof FormRecord;

/** Los `Untyped*` de Angular 14+: la misma clase, sin tipar (el camino de migración de formularios viejos). */
// biome-ignore lint/suspicious/noExplicitAny: `Untyped*` es `any` a propósito, como en Angular
export type UntypedFormControl = FormControl<any>;
export const UntypedFormControl = FormControl;
// biome-ignore lint/suspicious/noExplicitAny: ídem
export type UntypedFormGroup = FormGroup<any>;
export const UntypedFormGroup = FormGroup;
// biome-ignore lint/suspicious/noExplicitAny: ídem
export type UntypedFormArray = FormArray<any>;
export const UntypedFormArray = FormArray;
export type UntypedFormBuilder = FormBuilder;
export const UntypedFormBuilder = FormBuilder;
