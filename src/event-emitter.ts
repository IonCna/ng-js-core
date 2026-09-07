import { Subject } from "rxjs";

// biome-ignore lint/suspicious/noExplicitAny: default genérico de Angular real — `new EventEmitter()` sin tipo explícito infiere `any`, no `void`.
export class EventEmitter<T = any> extends Subject<T> {
    emit(value?: T): void {
        super.next(value as T);
    }
}