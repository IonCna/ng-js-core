const FORWARD_REF = Symbol("ngjs-forward-ref");

type Tagged<T> = T & { [FORWARD_REF]?: true };

/**
 * Envuelve una referencia circular: en vez de pasar la clase, pasás una
 * función que la devuelve más tarde. `fn` no corre acá — solo se marca; algo
 * que resuelva el token (`ReflectInjection.translate`) la llama recién cuando
 * hace falta el valor de verdad, momento en el que la clase referida ya
 * existe.
 */
export function forwardRef<T>(fn: () => T): T {
  const tagged = fn as Tagged<() => T>;
  tagged[FORWARD_REF] = true;
  tagged.toString = () => String(resolveForwardRef(tagged as unknown as T));
  return tagged as unknown as T;
}

/** Desenvuelve un `forwardRef`; cualquier otro valor pasa tal cual. */
export function resolveForwardRef<T>(token: T): T {
  const maybe = token as Tagged<() => T>;
  if (typeof maybe === "function" && maybe[FORWARD_REF] === true) {
    return maybe();
  }
  return token;
}

/** true si `token` es un `forwardRef` todavía sin desenvolver. */
export function isForwardRef(token: unknown): boolean {
  return typeof token === "function" && (token as Tagged<unknown>)[FORWARD_REF] === true;
}
