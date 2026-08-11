import type { ProviderToken } from "@/core/queries/query-types";

export function getControllerTokens(controller: object): readonly ProviderToken<unknown>[] {
  const tokens: ProviderToken<unknown>[] = [];
  const capturedTokens = new Set<ProviderToken<unknown>>();
  let prototype = Object.getPrototypeOf(controller) as { constructor?: ProviderToken<unknown> } | null;

  while (prototype && prototype !== Object.prototype) {
    const token = prototype.constructor;
    if (token && !capturedTokens.has(token)) {
      capturedTokens.add(token);
      tokens.push(token);
    }

    prototype = Object.getPrototypeOf(prototype) as { constructor?: ProviderToken<unknown> } | null;
  }

  return tokens;
}
