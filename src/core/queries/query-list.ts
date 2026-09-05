import { type Observable, Subject } from "rxjs";

function flattenResults<T>(resultsTree: readonly (readonly unknown[] | T)[]): T[] {
  return resultsTree.flat(Number.POSITIVE_INFINITY) as T[];
}

/**
 * La usa `@ViewChildren`/`@ContentChildren` (decorador) — las funciones
 * sueltas `viewChildren()`/`contentChildren()` devuelven un array plano en
 * cambio, a propósito (mismo split que Angular real: la función signal-based
 * da array, el decorador viejo da `QueryList`). Sin dependencia de
 * AngularJS: solo RxJS.
 */
export class QueryList<T> implements Iterable<T> {
  private readonly changesSubject = new Subject<QueryList<T>>();
  private changesDetected = false;
  private lastNotifiedResults: T[] = [];
  private results: T[] = [];

  readonly changes: Observable<QueryList<T>> = this.changesSubject.asObservable();

  constructor(private readonly emitDistinctChangesOnly = true) {}

  get length(): number {
    return this.results.length;
  }

  get first(): T {
    return this.results[0];
  }

  get last(): T {
    return this.results[this.length - 1];
  }

  get(index: number): T | undefined {
    return this.results[index];
  }

  map<U>(fn: (item: T, index: number, array: T[]) => U): U[] {
    return this.results.map(fn);
  }

  filter<S extends T>(predicate: (value: T, index: number, array: readonly T[]) => value is S): S[];
  filter(predicate: (value: T, index: number, array: readonly T[]) => unknown): T[];
  filter(predicate: (value: T, index: number, array: readonly T[]) => unknown): T[] {
    return this.results.filter(predicate);
  }

  find(fn: (item: T, index: number, array: T[]) => boolean): T | undefined {
    return this.results.find(fn);
  }

  reduce<U>(fn: (previous: U, current: T, index: number, array: T[]) => U, initialValue: U): U {
    return this.results.reduce(fn, initialValue);
  }

  forEach(fn: (item: T, index: number, array: T[]) => void): void {
    this.results.forEach(fn);
  }

  some(fn: (value: T, index: number, array: T[]) => boolean): boolean {
    return this.results.some(fn);
  }

  toArray(): T[] {
    return [...this.results];
  }

  toString(): string {
    return this.results.toString();
  }

  reset(resultsTree: readonly (readonly unknown[] | T)[], identityAccessor?: (value: T) => unknown): void {
    const nextResults = flattenResults<T>(resultsTree);
    const identity = identityAccessor ?? ((value: T) => value);
    this.changesDetected =
      nextResults.length !== this.lastNotifiedResults.length ||
      nextResults.some((value, index) => identity(value) !== identity(this.lastNotifiedResults[index]));
    this.results = nextResults;
  }

  notifyOnChanges(): void {
    if (!this.emitDistinctChangesOnly || this.changesDetected) {
      this.changesSubject.next(this);
    }

    this.lastNotifiedResults = [...this.results];
    this.changesDetected = false;
  }

  destroy(): void {
    this.changesSubject.complete();
  }

  [Symbol.iterator](): Iterator<T> {
    return this.results[Symbol.iterator]();
  }
}
