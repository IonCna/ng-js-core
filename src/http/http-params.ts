type HttpParamValue = string | number | boolean;

/** Cómo se codifican/decodifican las claves y valores de `HttpParams` (`@angular/common/http`). */
export interface HttpParameterCodec {
  encodeKey(key: string): string;
  encodeValue(value: string): string;
  decodeKey(key: string): string;
  decodeValue(value: string): string;
}

/**
 * El codec por defecto de Angular: `encodeURIComponent` pero dejando sin escapar `@ : $ , ; = ? /` (lo que Angular
 * considera seguro en una query) — la misma URL que arma Angular.
 */
export class HttpUrlEncodingCodec implements HttpParameterCodec {
  encodeKey(key: string): string {
    return standardEncoding(key);
  }

  encodeValue(value: string): string {
    return standardEncoding(value);
  }

  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }

  decodeValue(value: string): string {
    return decodeURIComponent(value);
  }
}

const STANDARD_ENCODING_REPLACEMENTS: Record<string, string> = {
  "40": "@",
  "3A": ":",
  "24": "$",
  "2C": ",",
  "3B": ";",
  "3D": "=",
  "3F": "?",
  "2F": "/",
};

function standardEncoding(value: string): string {
  return encodeURIComponent(value).replace(/%(\d[a-f0-9])/gi, (match, code: string) => STANDARD_ENCODING_REPLACEMENTS[code.toUpperCase()] ?? match);
}

export interface HttpParamsOptions {
  /** Una query ya armada (`"a=1&b=2"`, con o sin `?`). */
  fromString?: string;
  fromObject?: { [param: string]: HttpParamValue | ReadonlyArray<HttpParamValue> };
  encoder?: HttpParameterCodec;
}

/**
 * `HttpParams` de `@angular/common/http`: inmutable (`set`/`append`/`delete` devuelven una copia), con las mismas
 * opciones de construcción (`fromString`/`fromObject`/`encoder`) y la misma serialización que Angular.
 */
export class HttpParams {
  private readonly map = new Map<string, string[]>();
  private readonly encoder: HttpParameterCodec;

  constructor(options: HttpParamsOptions = {}) {
    this.encoder = options.encoder ?? new HttpUrlEncodingCodec();
    if (options.fromString !== undefined && options.fromObject !== undefined) {
      throw new Error("Cannot specify both fromString and fromObject.");
    }
    if (options.fromString !== undefined) this.parse(options.fromString);
    else if (options.fromObject) {
      for (const [key, value] of Object.entries(options.fromObject)) this.appendInPlace(key, value);
    }
  }

  has(param: string): boolean {
    return this.map.has(param);
  }

  get(param: string): string | null {
    return this.map.get(param)?.[0] ?? null;
  }

  getAll(param: string): string[] | null {
    const values = this.map.get(param);
    return values ? [...values] : null;
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  append(param: string, value: HttpParamValue): HttpParams {
    return this.copy((params) => params.appendInPlace(param, value));
  }

  appendAll(params: { [param: string]: HttpParamValue | ReadonlyArray<HttpParamValue> }): HttpParams {
    return this.copy((copy) => {
      for (const [key, value] of Object.entries(params)) copy.appendInPlace(key, value);
    });
  }

  set(param: string, value: HttpParamValue): HttpParams {
    return this.copy((params) => params.map.set(param, [String(value)]));
  }

  /** Sin `value`, saca el parámetro; con `value`, solo esa aparición (como Angular). */
  delete(param: string, value?: HttpParamValue): HttpParams {
    return this.copy((params) => {
      const current = params.map.get(param);
      if (value === undefined || !current) {
        params.map.delete(param);
        return;
      }
      const rest = current.filter((item) => item !== String(value));
      if (rest.length) params.map.set(param, rest);
      else params.map.delete(param);
    });
  }

  toString(): string {
    return this.keys()
      .map((key) => {
        const encodedKey = this.encoder.encodeKey(key);
        return (this.map.get(key) ?? []).map((value) => `${encodedKey}=${this.encoder.encodeValue(value)}`).join("&");
      })
      .filter((param) => param !== "")
      .join("&");
  }

  private parse(raw: string): void {
    const query = raw.replace(/^\?/, "");
    if (!query) return;
    for (const param of query.split("&")) {
      const index = param.indexOf("=");
      const [key, value] =
        index === -1
          ? [this.encoder.decodeKey(param), ""]
          : [this.encoder.decodeKey(param.slice(0, index)), this.encoder.decodeValue(param.slice(index + 1))];
      this.map.set(key, [...(this.map.get(key) ?? []), value]);
    }
  }

  private appendInPlace(key: string, value: HttpParamValue | ReadonlyArray<HttpParamValue>): void {
    const values = (Array.isArray(value) ? value : [value]).map(String);
    this.map.set(key, [...(this.map.get(key) ?? []), ...values]);
  }

  private copy(change: (params: HttpParams) => void): HttpParams {
    const copy = new HttpParams({ encoder: this.encoder });
    for (const [key, values] of this.map) copy.map.set(key, [...values]);
    change(copy);
    return copy;
  }
}
