const FORWARD_REF = Symbol("ngjs.forwardRef");

type ForwardRef<T> = (() => T) & { [FORWARD_REF]?: true };

/** Difiere una referencia circular para que el compilador pueda resolverla. */
export function forwardRef<T>(factory: () => T): T {
  const ref = factory as ForwardRef<T>;
  ref[FORWARD_REF] = true;
  return ref as unknown as T;
}

/** Devuelve el valor real de una referencia creada con `forwardRef`. */
export function resolveForwardRef<T>(value: T): T {
  const ref = value as T & { [FORWARD_REF]?: true };
  return typeof ref === "function" && ref[FORWARD_REF] ? (ref as unknown as () => T)() : value;
}

export function isForwardRef(value: unknown): boolean {
  const ref = value as { [FORWARD_REF]?: true } | undefined;
  return typeof value === "function" && ref?.[FORWARD_REF] === true;
}
