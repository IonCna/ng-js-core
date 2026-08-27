import type { IAttributes, IController, IDirective } from "angular";
import { NgDisabled, NgDisabledImpl } from "@/core/abstractions/ng-disabled";

export class NgDisabledDecorator extends NgDisabled implements IController {
  private readonly implementation = new NgDisabledImpl();

  constructor(private readonly attrs: IAttributes) {
    super();
  }

  $onInit(): void {
    this.attrs.$observe<boolean>("disabled", (value) => {
      this.implementation.setDisabled(value === true || String(value) === "disabled");
    });
  }

  get disabled(): boolean {
    return this.implementation.disabled;
  }

  onChange(callback: (disabled: boolean) => void): () => void {
    return this.implementation.onChange(callback);
  }

  static get $inject(): readonly ["$attrs"] {
    return ["$attrs"];
  }

  static get $name(): string {
    return "ngDisabled";
  }

  static $factory(): IDirective {
    return {
      controller: NgDisabledDecorator,
      restrict: "A",
      bindToController: true,
      scope: false,
    };
  }
}

export function decorNgDisabled($delegate: IDirective[]): IDirective[] {
  for (const directive of $delegate) {
    directive.controller = NgDisabledDecorator;
  }

  return $delegate;
}
