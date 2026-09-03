import { type Observable, Subject } from "rxjs";

function flattenResults<T>(resultsTree: readonly (readonly unknown[] | T)[]): T[] {
  return resultsTree.flat(Number.POSITIVE_INFINITY) as T[];
}

export class QueryList<T> implements Iterable<T> {
  private readonly changesSubject = new Subject<QueryList<T>>();
  private changesDetected = false;
  private dirtyCallback?: () => void;
  private lastNotifiedResults: T[] = [];
  private results: T[] = [];

  dirty = true;
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
    this.dirty = false;
  }

  notifyOnChanges(): void {
    if (!this.emitDistinctChangesOnly || this.changesDetected) {
      this.changesSubject.next(this);
    }

    this.lastNotifiedResults = [...this.results];
    this.changesDetected = false;
  }

  setDirty(): void {
    this.dirty = true;
    this.dirtyCallback?.();
  }

  onDirty(callback: () => void): void {
    this.dirtyCallback = callback;
  }

  destroy(): void {
    this.changesSubject.complete();
  }

  [Symbol.iterator](): Iterator<T> {
    return this.results[Symbol.iterator]();
  }
}
