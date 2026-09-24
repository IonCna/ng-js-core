import type angular from "angular";
import { Inject } from "@/core/di/inject.ts";
import { Directive } from "@/core/metadata/directive.ts";
import { Input } from "@/core/metadata/input.ts";
import { publishControlContainer } from "@/forms/control-container.ts";
import type { FormGroup } from "@/forms/form-group.ts";

@Directive({ selector: "[formGroup]" })
export class FormGroupDirective {
  @Input() formGroup!: FormGroup;

  constructor(@Inject("$element") private readonly $element: angular.IAugmentedJQuery) {}

  ngOnInit(): void {
    publishControlContainer(this.$element, this.formGroup);
  }
}
