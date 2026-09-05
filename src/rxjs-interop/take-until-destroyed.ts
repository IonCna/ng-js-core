import { EMPTY, type MonoTypeOperatorFunction, type Observable, Subject, takeUntil } from "rxjs";
import type { DestroyRef } from "@/rxjs-interop/destroy-ref.ts";

/**
 * A diferencia del `takeUntilDestroyed()` real de Angular, `destroyRef` NO
 * es opcional acá: real Angular lo resuelve solo vía `inject(DestroyRef)`
 * dentro de un contexto de inyección ambiental, y nosotros no tenemos eso
 * (`DestroyRef` se inyecta por-instancia, no hay "contexto activo" fuera de
 * la construcción de un controller) — así que siempre se pasa explícito.
 */
export function takeUntilDestroyed<T>(destroyRef: DestroyRef): MonoTypeOperatorFunction<T> {
  const destroyed$ = new Subject<void>();
  // si destroyRef YA estaba destruido, este callback corre sincrónico, ACÁ
  // MISMO — antes de que exista ningún subscriber de destroyed$. Un Subject
  // no reproduce el `next()` ya emitido a quien se suscribe después (solo
  // reproduce que ya está completo), así que `takeUntil(destroyed$)` nunca
  // dispararía para un subscriber tardío — de ahí la bandera aparte.
  let alreadyDestroyed = false;

  destroyRef.onDestroy(() => {
    alreadyDestroyed = true;
    destroyed$.next();
    destroyed$.complete();
  });

  return (source) => (alreadyDestroyed ? (EMPTY as Observable<T>) : source.pipe(takeUntil(destroyed$)));
}
