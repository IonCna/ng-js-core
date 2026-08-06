import type { IScope } from "angular";
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

  static get $name(): string {
    return "ng.change-detector-ref";
  }

  static get $inject(): readonly ["$rootScope"] {
    return ["$rootScope"];
  }
}
