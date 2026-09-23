import { CommonModule } from "@/common/common.module.ts";
import { NgModule } from "@/core/metadata/ng-module.ts";
import {
  FormArrayNameDirective,
  FormControlNameDirective,
  FormGroupDirective,
} from "@/forms/directives/index.ts";

@NgModule({
  imports: [CommonModule],
  declarations: [FormGroupDirective, FormControlNameDirective, FormArrayNameDirective],
})
export class FormsModule {}
