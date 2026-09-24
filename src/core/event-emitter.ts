import { Subject } from "rxjs";

/** Emisor compatible con Angular, basado en `rxjs.Subject`. */
export class EventEmitter<T = any> extends Subject<T> {
  emit(value?: T): void {
    super.next(value as T);
  }
}
