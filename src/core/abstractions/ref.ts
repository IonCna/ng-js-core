import type { IScope } from "angular";

export abstract class Refs {
  abstract markForCheck(): void;
  abstract detectChanges(): void;
}

export class RefImpl implements Refs {
  constructor(protected $scope: IScope) {}

  markForCheck(): void {
    this.$scope.$evalAsync()
  }

  detectChanges(): void {
    this.$scope.$applyAsync()
  }
}
