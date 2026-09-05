type HttpParamValue = string | number | boolean;

/** Inmutable, igual que `HttpHeaders` — `set`/`append`/`delete` devuelven una copia. */
export class HttpParams {
  private readonly params = new Map<string, string[]>();

  constructor(init?: string | Readonly<Record<string, HttpParamValue | readonly HttpParamValue[]>>) {
    if (typeof init === "string") {
      const search = init.startsWith("?") ? init.slice(1) : init;
      for (const pair of search.split("&")) {
        if (!pair) continue;
        const [rawKey, rawValue = ""] = pair.split("=");
        this.appendInPlace(decodeURIComponent(rawKey), decodeURIComponent(rawValue));
      }
    } else if (init) {
      for (const [key, value] of Object.entries(init)) this.appendInPlace(key, value);
    }
  }

  has(key: string): boolean {
    return this.params.has(key);
  }

  get(key: string): string | null {
    return this.params.get(key)?.[0] ?? null;
  }

  getAll(key: string): string[] | null {
    const values = this.params.get(key);
    return values ? [...values] : null;
  }

  keys(): string[] {
    return [...this.params.keys()];
  }

  set(key: string, value: HttpParamValue | readonly HttpParamValue[]): HttpParams {
    const copy = this.clone();
    copy.params.set(key, (Array.isArray(value) ? value : [value]).map(String));
    return copy;
  }

  append(key: string, value: HttpParamValue | readonly HttpParamValue[]): HttpParams {
    const copy = this.clone();
    copy.appendInPlace(key, value);
    return copy;
  }

  delete(key: string): HttpParams {
    const copy = this.clone();
    copy.params.delete(key);
    return copy;
  }

  toString(): string {
    const parts: string[] = [];
    for (const [key, values] of this.params) {
      for (const value of values) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
    return parts.join("&");
  }

  private appendInPlace(key: string, value: HttpParamValue | readonly HttpParamValue[]): void {
    const values = (Array.isArray(value) ? value : [value]).map(String);
    this.params.set(key, [...(this.params.get(key) ?? []), ...values]);
  }

  private clone(): HttpParams {
    const copy = new HttpParams();
    for (const [key, values] of this.params) copy.params.set(key, [...values]);
    return copy;
  }
}
