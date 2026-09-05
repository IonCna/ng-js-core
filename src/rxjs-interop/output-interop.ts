import type { Observable } from "rxjs";
import { EventEmitter } from "@/event-emitter.ts";

/** `EventEmitter` ya es un `Subject` (ver CONCEPTOS "interop") — esto es solo `.asObservable()`, para no exponer `.emit()`/`.next()` a quien consume. */
export function outputToObservable<T>(emitter: EventEmitter<T>): Observable<T> {
  return emitter.asObservable();
}

/** Lo inverso: un `EventEmitter` nuevo que reenvía cada emisión (y error/complete) de `source`. */
export function outputFromObservable<T>(source: Observable<T>): EventEmitter<T> {
  const emitter = new EventEmitter<T>();

  source.subscribe({
    next: (value) => emitter.emit(value),
    error: (error) => emitter.error(error),
    complete: () => emitter.complete(),
  });

  return emitter;
}
