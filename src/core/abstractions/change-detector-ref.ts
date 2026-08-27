import type { IScope } from "angular";

export abstract class ChangeDetectorRef {
  static get $name(): string {
    return "ChangeDetectorRef";
  }

  abstract markForCheck(): void;
  abstract detach(): void;
  abstract detectChanges(): void;
  abstract reattach(): void;
}

export class ChangeDetectorRefImpl extends ChangeDetectorRef {
  private attached = true;
  private changeDetectorDestroyed = false;

  constructor(protected readonly scope: IScope) {
    super();

    scope.$on("$destroy", () => {
      this.changeDetectorDestroyed = true;
      this.attached = false;
    });
  }

  markForCheck(): void {
    if (!this.attached || this.changeDetectorDestroyed || this.scope.$$phase) return;
    this.scope.$applyAsync();
  }

  detach(): void {
    if (this.changeDetectorDestroyed) return;

    this.attached = false;
    this.scope.$suspend();
  }

  detectChanges(): void {
    if (this.changeDetectorDestroyed) return;
    this.scope.$applyAsync();
  }

  reattach(): void {
    if (this.changeDetectorDestroyed || this.attached) return;
    this.attached = true;
    this.scope.$resume();
  }
}
