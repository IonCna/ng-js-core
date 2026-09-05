/** Calcado de `@angular/router` — lectura inmutable de los parámetros de ruta. */
export interface ParamMap {
  has(name: string): boolean;
  get(name: string): string | null;
  getAll(name: string): string[];
  readonly keys: string[];
}

type RawParams = Record<string, string | string[] | undefined>;

class ParamMapImpl implements ParamMap {
  constructor(private readonly params: RawParams) {}

  has(name: string): boolean {
    return Object.hasOwn(this.params, name);
  }

  get(name: string): string | null {
    if (!this.has(name)) return null;
    const value = this.params[name];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }

  getAll(name: string): string[] {
    if (!this.has(name)) return [];
    const value = this.params[name];
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
  }

  get keys(): string[] {
    return Object.keys(this.params);
  }
}

export function convertToParamMap(params: RawParams): ParamMap {
  return new ParamMapImpl(params);
}
