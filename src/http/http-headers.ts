/** Inmutable — cada `set`/`append`/`delete` devuelve una copia nueva, como el `HttpHeaders` real. */
export class HttpHeaders {
  private readonly headers = new Map<string, string[]>();

  constructor(init?: string | Readonly<Record<string, string | readonly string[]>>) {
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
    return [...this.headers.keys()];
  }

  set(name: string, value: string | readonly string[]): HttpHeaders {
    const copy = this.clone();
    copy.headers.set(name.toLowerCase(), Array.isArray(value) ? [...value] : [value as string]);
    return copy;
  }

  append(name: string, value: string | readonly string[]): HttpHeaders {
    const copy = this.clone();
    copy.appendInPlace(name, value);
    return copy;
  }

  delete(name: string): HttpHeaders {
    const copy = this.clone();
    copy.headers.delete(name.toLowerCase());
    return copy;
  }

  /** Aplanado a `{nombre: "v1, v2"}` — lo que espera `$httpBackend`. */
  toObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, values] of this.headers) result[key] = values.join(", ");
    return result;
  }

  private appendInPlace(name: string, value: string | readonly string[]): void {
    const key = name.toLowerCase();
    const values = Array.isArray(value) ? value : [value as string];
    this.headers.set(key, [...(this.headers.get(key) ?? []), ...values]);
  }

  private clone(): HttpHeaders {
    const copy = new HttpHeaders();
    for (const [key, values] of this.headers) copy.headers.set(key, [...values]);
    return copy;
  }
}
