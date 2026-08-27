import type { IScope } from "angular";
import { ChangeDetectorRef, ChangeDetectorRefImpl } from "@/core/abstractions/change-detector-ref";

/** AngularJS DI wrapper for the scope-independent implementation. */
export class NgChangeDetectorRef extends ChangeDetectorRef {
  private readonly implementation: ChangeDetectorRefImpl;

  constructor(scope: IScope) {
    super();
    this.implementation = new ChangeDetectorRefImpl(scope);
  }

  markForCheck(): void {
    this.implementation.markForCheck();
  }

  detach(): void {
    this.implementation.detach();
  }

  detectChanges(): void {
    this.implementation.detectChanges();
  }

  reattach(): void {
    this.implementation.reattach();
  }

  static get $inject(): readonly ["$rootScope"] {
    return ["$rootScope"];
  }
}
