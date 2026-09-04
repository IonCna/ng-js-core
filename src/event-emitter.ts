import { Subject } from "rxjs";

export class EventEmitter<T = void> extends Subject<T> {
    emit(value?: T): void {
        super.next(value as T);
    }
}