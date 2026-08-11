import type { TemplateRef } from "@/common/ng-template.ts";
import type { ElementRef } from "@/core";

export abstract class Refs {
  abstract markForCheck(): void;
  abstract detectChanges(): void;
}

export abstract class ViewRef extends Refs {
  abstract destroy(): void;
  abstract readonly destroyed: boolean;
  abstract onDestroy(callback: () => void): void;
  abstract override markForCheck(): void;
  abstract override detectChanges(): void;
}

export abstract class EmbeddedViewRef<C = ContextObject> extends ViewRef {
  abstract context: C;
  abstract readonly rootNodes: Node[];
  abstract override destroy(): void;
  abstract override readonly destroyed: boolean;
  abstract override onDestroy(callback: () => void): void;
  abstract override markForCheck(): void;
  abstract override detectChanges(): void;
}

export abstract class ViewContainerRef {
  abstract readonly element: ElementRef;
  abstract clear(): void;
  abstract get(index: number): ViewRef | null;
  abstract readonly length: number;
  abstract createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C | undefined,
    options?: { index?: number | undefined } | undefined,
  ): EmbeddedViewRef<C>;
  abstract createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C | undefined,
    index?: number | undefined,
  ): EmbeddedViewRef<C>;
  abstract insert(viewRef: ViewRef, index?: number | undefined): ViewRef;
  abstract move(viewRef: ViewRef, currentIndex: number): ViewRef;
  abstract indexOf(viewRef: ViewRef): number;
  abstract remove(index?: number | undefined): void;
  abstract detach(index?: number | undefined): ViewRef | null;
}

export interface ContextObject {
  // biome-ignore lint/suspicious/noExplicitAny: Matches Angular's permissive template context contract.
  $implicit?: any;
  // biome-ignore lint/suspicious/noExplicitAny: Template contexts may expose arbitrary consumer-defined values.
  [key: string]: any;
}

export abstract class ChangeDetectorRef {
  abstract markForCheck(): void;
  abstract detach(): void;
  abstract detectChanges(): void;
  abstract reattach(): void;
}
