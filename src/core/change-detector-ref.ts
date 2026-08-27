import type { IScope } from "angular";
import { ChangeDetectorRefImpl } from "@/core/abstractions/change-detector-ref";
import { ChangeDetectorRef as AbstractChangeDetectorRef } from "@/core/abstracts";

/**
 * AngularJS-backed implementation of Angular's ChangeDetectorRef API.
 *
 * A controller receives an instance associated with its own scope. AngularJS
 * does not expose a supported API for removing one scope from the digest tree,
 * so `detach()` suppresses scheduled checks requested through this reference;
 * ambient application digests may still visit the scope.
 */
export class ChangeDetectorRef extends AbstractChangeDetectorRef {
  private readonly ref: ChangeDetectorRefImpl;

  constructor(scope: IScope) {
    super();
    this.ref = new ChangeDetectorRefImpl(scope);
  }

  markForCheck(): void {
    this.ref.markForCheck();
  }

  detach(): void {
    this.ref.detach();
  }

  detectChanges(): void {
    this.ref.detectChanges();
  }

  reattach(): void {
    this.ref.reattach();
  }

  static get $name(): string {
    return "ng.change-detector-ref";
  }

  static get $inject(): readonly ["$rootScope"] {
    return ["$rootScope"];
  }
}
