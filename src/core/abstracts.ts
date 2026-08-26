import type { TemplateRef } from "@/common/ng-template.ts";

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
    context?: C,
    options?: { index?: number },
  ): EmbeddedViewRef<C>;
  abstract createEmbeddedView<C>(
    templateRef: TemplateRef<C>,
    context?: C,
    index?: number,
  ): EmbeddedViewRef<C>;
  abstract insert(viewRef: ViewRef, index?: number): ViewRef;
  abstract move(viewRef: ViewRef, currentIndex: number): ViewRef;
  abstract indexOf(viewRef: ViewRef): number;
  abstract remove(index?: number): void;
  abstract detach(index?: number): ViewRef | null;
}

export interface ContextObject {
  $implicit?: any;
  [key: string]: any;
}

export abstract class ChangeDetectorRef {
  abstract markForCheck(): void;
  abstract detach(): void;
  abstract detectChanges(): void;
  abstract reattach(): void;
}

type Type<T = any> = new (...args: any[]) => T;

export abstract class ComponentRef<C> {
  abstract setInput(name: string, value: unknown): void;
  abstract readonly location: ElementRef<any>;
  abstract readonly instance: C;
  abstract readonly hostView: ViewRef;
  abstract readonly changeDetectorRef: ChangeDetectorRef;
  abstract readonly componentType: Type<any>;
  abstract destroy(): void;
  abstract onDestroy(callback: Function): void;
}

export abstract class NgDisabled {
  abstract readonly disabled: boolean;

  abstract onChange(
    callback: (disabled: boolean) => void,
  ): () => void;
}

export abstract class ElementRef<T = any> {
  constructor(public nativeElement: T) {};
}
