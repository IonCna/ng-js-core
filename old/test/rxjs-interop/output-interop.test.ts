import { Subject } from "rxjs";
import { describe, expect, it } from "vitest";
import { EventEmitter } from "@/event-emitter.ts";
import { outputFromObservable, outputToObservable } from "@/rxjs-interop/output-interop.ts";

describe("etapa 12 — outputToObservable / outputFromObservable", () => {
  it("outputToObservable: refleja cada .emit() del EventEmitter", () => {
    const emitter = new EventEmitter<number>();
    const seen: number[] = [];

    outputToObservable(emitter).subscribe((value) => seen.push(value));

    emitter.emit(1);
    emitter.emit(2);

    expect(seen).toEqual([1, 2]);
  });

  it("outputFromObservable: el EventEmitter resultante reenvía next/error/complete de la fuente", () => {
    const source = new Subject<string>();
    const emitter = outputFromObservable(source);
    const seen: string[] = [];
    let completed = false;

    emitter.subscribe({
      next: (value) => seen.push(value),
      complete: () => {
        completed = true;
      },
    });

    source.next("a");
    source.next("b");
    source.complete();

    expect(seen).toEqual(["a", "b"]);
    expect(completed).toBe(true);
  });

  it("outputFromObservable: los errores de la fuente también se reenvían", () => {
    const source = new Subject<number>();
    const emitter = outputFromObservable(source);
    let seenError: unknown;

    emitter.subscribe({ error: (error) => (seenError = error) });

    const boom = new Error("boom");
    source.error(boom);

    expect(seenError).toBe(boom);
  });
});
