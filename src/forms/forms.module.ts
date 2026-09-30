import { CommonModule } from "@/common/common.module.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import { FormArrayName, FormControlName, FormGroupDirective } from "@/forms/directives/index.ts";
import { FormsNativeModule } from "@/forms/forms-native.module.ts";

@NgModule({
  imports: [CommonModule, FormsNativeModule],
  declarations: [FormGroupDirective, FormControlName, FormArrayName],
})
export class FormsModule {}

/** El nombre de Angular para las directivas de reactive forms (acá, las mismas de `FormsModule`). */
export const ReactiveFormsModule = FormsModule;
