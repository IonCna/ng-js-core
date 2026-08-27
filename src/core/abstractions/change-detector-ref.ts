import type { IScope } from "angular";

export abstract class ChangeDetectorRef {
  abstract markForCheck(): void;
  abstract detach(): void;
  abstract detectChanges(): void;
  abstract reattach(): void;
}

export class ChangeDetectorRefImpl extends ChangeDetectorRef {
  private attached = true;
  private destroyed = false;

  constructor(private readonly scope: IScope) {
    super();

    scope.$on("$destroy", () => {
      this.destroyed = true;
      this.attached = false;
    });
  }

  markForCheck(): void {
    if (!this.attached || this.destroyed || this.scope.$$phase) return;
    this.scope.$applyAsync();
  }

  detach(): void {
    if (this.destroyed) return;
    this.attached = false;
  }

  detectChanges(): void {
    if (this.destroyed || this.scope.$$phase) return;
    this.scope.$digest();
  }

  reattach(): void {
    if (this.destroyed || this.attached) return;
    this.attached = true;
  }
}
