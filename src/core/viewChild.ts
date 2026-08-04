export interface QuerySignal<T> {
    (): T
}

export interface ViewChildOptions<ReadT = unknown> {
    read?: ReadT;
    debugName?: string;
}

function createViewChildQuery(locator: string, options?: ViewChildOptions, required = false) {
}

function optionalViewChild<LocatorT>(
    locator: string,
    options?: ViewChildOptions,
): QuerySignal<LocatorT | undefined>;

function optionalViewChild<LocatorT, ReadT>(
    locator: string,
    options: ViewChildOptions<ReadT>,
): QuerySignal<ReadT | undefined>;

function optionalViewChild(
    locator: string,
    options?: ViewChildOptions,
): QuerySignal<unknown> {
    return createViewChildQuery(locator, options, false);
}

function requiredViewChild<LocatorT>(
    locator: string,
    options?: ViewChildOptions,
): QuerySignal<LocatorT>;

function requiredViewChild<LocatorT, ReadT>(
    locator: string,
    options: ViewChildOptions<ReadT>,
): QuerySignal<ReadT>;

function requiredViewChild(
    locator: string,
    options?: ViewChildOptions,
): QuerySignal<unknown> {
    return createViewChildQuery(locator, options, true);
}

export const viewChild = Object.assign(optionalViewChild, {
    required: requiredViewChild,
});