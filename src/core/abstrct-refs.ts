export abstract class Refs {
    abstract markForCheck(): void;
    abstract detach(): void;
    abstract detectChanges(): void;
    abstract reattach(): void;
}

export abstract class ViewRef extends Refs {
    abstract destroy(): void;
    abstract readonly destroyed: boolean;
    abstract onDestroy(callback: Function): void;
    abstract override markForCheck(): void;
    abstract override detach(): void;
    abstract override detectChanges(): void;
    abstract override reattach(): void;
}

export abstract class EmbeddedViewRef<C = ContextObject> extends ViewRef {
    abstract context: C;
    abstract readonly rootNodes: any[];
    abstract override destroy(): void;
    abstract override readonly destroyed: boolean;
    abstract override onDestroy(callback: Function): void;
    abstract override markForCheck(): void;
    abstract override detach(): void;
    abstract override detectChanges(): void;
    abstract override reattach(): void;
}

export interface ContextObject {
    $implicit?: any
    [key: string]: any
}
