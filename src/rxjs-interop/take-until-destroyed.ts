import { EMPTY, type MonoTypeOperatorFunction, type Observable, Subject, takeUntil } from "rxjs";
import { inject } from "@/core/di/inject.ts";
import type { DestroyRef } from "@/core/refs/destroy-ref.ts";

/** Igual que Angular: usa el `DestroyRef` explícito o el contexto de inyección activo. */
export function takeUntilDestroyed<T>(destroyRef?: DestroyRef): MonoTypeOperatorFunction<T> {
  const ref = destroyRef ?? inject(DestroyRef);
  const destroyed$ = new Subject<void>();
  let alreadyDestroyed = false;

  ref.onDestroy(() => {
    alreadyDestroyed = true;
    destroyed$.next();
    destroyed$.complete();
  });

  return (source) => (alreadyDestroyed ? (EMPTY as Observable<T>) : source.pipe(takeUntil(destroyed$)));
}
