type HeaderValue = string | number | ReadonlyArray<string | number>;

/**
 * `HttpHeaders` de `@angular/common/http`: inmutable (`set`/`append`/`delete` devuelven una copia), búsqueda sin
 * distinguir mayúsculas y, como Angular, conserva el nombre tal como se escribió (`keys()` y lo que se manda).
 */
export class HttpHeaders {
  /** nombre en minúsculas → valores */
  private readonly headers = new Map<string, string[]>();
  /** nombre en minúsculas → nombre como se escribió */
  private readonly names = new Map<string, string>();

  constructor(init?: string | { [name: string]: HeaderValue }) {
    if (typeof init === "string") {
      for (const line of init.split("\n")) {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) continue;

        const name = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (name) this.appendInPlace(name, value);
      }
    } else if (init) {
      for (const [name, value] of Object.entries(init)) this.appendInPlace(name, value);
    }
  }

  has(name: string): boolean {
    return this.headers.has(name.toLowerCase());
  }

  get(name: string): string | null {
    return this.headers.get(name.toLowerCase())?.[0] ?? null;
  }

  getAll(name: string): string[] | null {
    const values = this.headers.get(name.toLowerCase());
    return values ? [...values] : null;
  }

  keys(): string[] {
    return [...this.names.values()];
  }

  set(name: string, value: string | string[]): HttpHeaders {
    const copy = this.clone();
    copy.headers.delete(name.toLowerCase());
    copy.appendInPlace(name, value);
    return copy;
  }

  append(name: string, value: string | string[]): HttpHeaders {
    const copy = this.clone();
    copy.appendInPlace(name, value);
    return copy;
  }

  /** Sin `value`, saca el header; con `value`, solo ese valor (como Angular). */
  delete(name: string, value?: string | string[]): HttpHeaders {
    const copy = this.clone();
    const key = name.toLowerCase();
    const current = copy.headers.get(key);
    const removed = value === undefined ? undefined : Array.isArray(value) ? value : [value];
    const rest = removed && current ? current.filter((item) => !removed.includes(item)) : [];
    if (rest.length) copy.headers.set(key, rest);
    else {
      copy.headers.delete(key);
      copy.names.delete(key);
    }
    return copy;
  }

  forEach(fn: (name: string, values: string[]) => void): void {
    for (const [key, values] of this.headers) fn(this.names.get(key) ?? key, [...values]);
  }

  /** Aplanado a `{ Nombre: "v1,v2" }` — lo que espera `$httpBackend` (como el `setRequestHeader` de Angular). */
  toObject(): Record<string, string> {
    const result: Record<string, string> = {};
    this.forEach((name, values) => {
      result[name] = values.join(",");
    });
    return result;
  }

  private appendInPlace(name: string, value: HeaderValue): void {
    const key = name.toLowerCase();
    const values = (Array.isArray(value) ? value : [value]).map(String);
    this.headers.set(key, [...(this.headers.get(key) ?? []), ...values]);
    if (!this.names.has(key)) this.names.set(key, name);
  }

  private clone(): HttpHeaders {
    const copy = new HttpHeaders();
    for (const [key, values] of this.headers) copy.headers.set(key, [...values]);
    for (const [key, name] of this.names) copy.names.set(key, name);
    return copy;
  }
}
