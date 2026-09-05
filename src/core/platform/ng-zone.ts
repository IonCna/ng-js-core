/// <reference types="zone.js" />

import { EventEmitter } from "@/event-emitter";
import type { NgZoneFactory } from "@/core/platform/digest-bridge";

export interface NgZoneOptions {
    readonly enableLongStackTrace?: boolean;
    readonly shouldCoalesceEventChangeDetection?: boolean;
    readonly shouldCoalesceRunChangeDetection?: boolean;
}

export abstract class NgZone {
    static readonly $name = "NgZone";

    abstract readonly onUnstable: EventEmitter<void>;
    abstract readonly onMicrotaskEmpty: EventEmitter<void>;
    abstract readonly onStable: EventEmitter<void>;
    abstract readonly onError: EventEmitter<unknown>;

    protected constructor(
        protected readonly factory: NgZoneFactory,
        protected readonly options: NgZoneOptions = {},
    ) {}

    get isStable(): boolean {
        return this.factory.stable;
    }

    get hasPendingMicrotasks(): boolean {
        return this.factory.hasPendingMicrotasks;
    }

    get hasPendingMacrotasks(): boolean {
        return this.factory.hasPendingMacrotasks;
    }

    run<T>(fn: (...a: any[]) => T, applyThis?: any, applyArgs?: any[]): T {
        return this.factory.run(() => fn.apply(applyThis, applyArgs ?? []));
    }

    runGuarded<T>(fn: (...a: any[]) => T, applyThis?: any, applyArgs?: any[]): T {
        try {
            return this.run(fn, applyThis, applyArgs);
        } catch (err) {
            this.factory.onError.emit(err); // rethrow real = ErrorHandler (etapa 2)
            return undefined as T;
        }
    }

    runTask<T>(fn: (...a: any[]) => T, applyThis?: any, applyArgs?: any[], _name?: string): T {
        return this.run(fn, applyThis, applyArgs); // v1: sin instrumentación de task
    }

    runOutsideAngular<T>(fn: (...a: any[]) => T): T {
        return this.factory.runOutside(fn);
    }

    static isInAngularZone(): boolean {
        return typeof Zone !== "undefined" && Zone.current.get(NgZone.$name) === true;
    }

    static assertInAngularZone(): void {
        if (!NgZone.isInAngularZone()) {
            throw new Error("Expected to be in Angular Zone, but it is not");
        }
    }

    static assertNotInAngularZone(): void {
        if (NgZone.isInAngularZone()) {
            throw new Error("Expected to not be in Angular Zone, but it is");
        }
    }
}

export class NgZoneImpl extends NgZone {
    readonly onUnstable: EventEmitter<void>;
    readonly onMicrotaskEmpty: EventEmitter<void>;
    readonly onStable: EventEmitter<void>;
    readonly onError: EventEmitter<unknown>;

    constructor(factory: NgZoneFactory, options: NgZoneOptions = {}) {
        super(factory, options);
        this.onUnstable = factory.onUnstable; // referencias estables → se copian acá
        this.onMicrotaskEmpty = factory.onMicrotaskEmpty;
        this.onStable = factory.onStable;
        this.onError = factory.onError;
    }
}
