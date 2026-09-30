/**
 * `HttpContextToken`/`HttpContext` de `@angular/common/http`: datos que viajan con un request (no se mandan al
 * servidor) para que los interceptors los lean — `http.get(url, { context: new HttpContext().set(CACHE, false) })`.
 */
export class HttpContextToken<T> {
  constructor(readonly defaultValue: () => T) {}
}

/** Mutable, como en Angular: `set`/`delete` devuelven el mismo contexto (para encadenar). */
export class HttpContext {
  private readonly map = new Map<HttpContextToken<unknown>, unknown>();

  set<T>(token: HttpContextToken<T>, value: T): HttpContext {
    this.map.set(token as HttpContextToken<unknown>, value);
    return this;
  }

  /** El valor puesto o, si no hay, el `defaultValue()` del token (que queda guardado). */
  get<T>(token: HttpContextToken<T>): T {
    if (!this.map.has(token as HttpContextToken<unknown>)) this.map.set(token as HttpContextToken<unknown>, token.defaultValue());
    return this.map.get(token as HttpContextToken<unknown>) as T;
  }

  delete(token: HttpContextToken<unknown>): HttpContext {
    this.map.delete(token);
    return this;
  }

  has(token: HttpContextToken<unknown>): boolean {
    return this.map.has(token);
  }

  keys(): IterableIterator<HttpContextToken<unknown>> {
    return this.map.keys();
  }
}
