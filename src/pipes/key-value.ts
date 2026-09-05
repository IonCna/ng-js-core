export interface KeyValue<K, V> {
  key: K;
  value: V;
}

function defaultCompare(a: KeyValue<unknown, unknown>, b: KeyValue<unknown, unknown>): number {
  const left = String(a.key);
  const right = String(b.key);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function sameShape(a: readonly KeyValue<unknown, unknown>[], b: readonly KeyValue<unknown, unknown>[]): boolean {
  return a.length === b.length && a.every((item, index) => item.key === b[index].key && item.value === b[index].value);
}

type KeyValueInput = Record<string, unknown> | Map<unknown, unknown> | null | undefined;
type Comparator = (a: KeyValue<unknown, unknown>, b: KeyValue<unknown, unknown>) => number;

/**
 * Sin filtro nativo en AngularJS (ver CONCEPTOS "Pipes") — objeto/`Map` a
 * array de `{key, value}`, ordenado por clave (o por `compareFn`). `$stateful`
 * a propósito: como el `KeyValuePipe` real de Angular, itera sobre algo que
 * puede mutar sin cambiar de referencia (agregar/sacar una clave a un mismo
 * objeto) — sin esto, AngularJS solo re-evalúa el binding si la referencia
 * del objeto cambia.
 *
 * `$stateful` implica que se llama SIEMPRE, en cada digest — así que si cada
 * llamada devolviera un array nuevo (con objetos `{key,value}` nuevos),
 * cualquiera que lo consuma por identidad (`ng-repeat`) nunca vería un
 * resultado "estable" y entraría en loop infinito de digest (confirmado con
 * un test real). Por eso memoiza: si nada cambió de verdad (mismas
 * claves/valores en el mismo orden), devuelve la MISMA referencia de antes.
 */
export function keyValueFilter(): (input: KeyValueInput, compareFn?: Comparator) => readonly KeyValue<unknown, unknown>[] {
  let lastResult: readonly KeyValue<unknown, unknown>[] = [];

  const filterFn = (input: KeyValueInput, compareFn: Comparator = defaultCompare): readonly KeyValue<unknown, unknown>[] => {
    if (input == null) return lastResult.length === 0 ? lastResult : (lastResult = []);

    const pairs =
      input instanceof Map
        ? Array.from(input.entries()).map(([key, value]) => ({ key, value }))
        : Object.keys(input).map((key) => ({ key, value: input[key] }));

    pairs.sort(compareFn);

    if (sameShape(lastResult, pairs)) return lastResult;

    lastResult = pairs;
    return pairs;
  };

  (filterFn as unknown as { $stateful: boolean }).$stateful = true;
  return filterFn;
}
