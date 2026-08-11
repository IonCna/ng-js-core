export type ProviderToken<T> = string | { readonly prototype: T };

export interface QueryReference {
  readonly candidates: ReadonlyMap<ProviderToken<unknown>, unknown>;
  readonly defaultValue: unknown;
  readonly locator: string;
  readonly node?: Node;
}

export interface QueryDescriptor<T = unknown> {
  readonly descendants?: boolean;
  readonly locator: ProviderToken<unknown>;
  readonly read?: ProviderToken<T>;
}
