import { isForwardRef, resolveForwardRef } from "@/core/di/forward-ref.ts";
import { getInjectableId } from "@/core/di/injectable-registry.ts";
import { InjectionToken } from "@/core/di/injection-token.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

export type InjectionEntry = ProviderToken<unknown> | string;

function isInjectionToken(token: unknown): token is InjectionToken<unknown> {
  return token instanceof InjectionToken;
}

function isNamedType(token: unknown): token is { $name: string } {
  return typeof token === "function" && typeof (token as { $name?: unknown }).$name === "string";
}

export class ReflectInjection {
  static translate(token: InjectionEntry): string {
    const resolved = resolveForwardRef(token);

    if (typeof resolved === "string") {
      return resolved;
    }

    if (isInjectionToken(resolved)) {
      return resolved.toString();
    }

    if (typeof resolved === "function") {
      const id = getInjectableId(resolved);
      if (id) return id;
    }

    if (isNamedType(resolved)) {
      return resolved.$name;
    }

    throw new Error(
      `ReflectInjection: no se pudo resolver el token "${String(resolved)}" a un nombre de $inject. ` +
        `Usá un string, un InjectionToken, o una clase con "static readonly $name".`,
    );
  }

  static toInject(tokens: readonly InjectionEntry[]): string[] {
    return tokens.map(ReflectInjection.translate);
  }
}

/**
 * Resuelve `target.$inject` in-place: cada entrada que no sea ya un string
 * (un `InjectionToken`, una clase con `$name`) se traduce a su nombre. Mutar
 * el mismo `$inject` (en vez de devolver un array aparte) es a propósito: así
 * `.service()`/`.controller()`/`.factory()` ven un `$inject` de puros
 * strings, como cualquier clase AngularJS nativa.
 *
 * `target` se tipa como `object` a secas, no como `Function` ni como algo con
 * `$inject: InjectionEntry[]`: `@types/angular` ya fija `Function.$inject`
 * como `readonly string[]` de forma global, así que cualquier clase que
 * declare `static $inject = [...tokens]` (no solo strings) deja de ser
 * asignable a `Function` para TS. Evitamos esa colisión sin tocar el tipo
 * ambiente, y leemos/escribimos `$inject` con un cast puntual.
 *
 * Si alguna entrada es un `forwardRef` sin desenvolver, no se traduce acá:
 * la clase referida puede no existir todavía (por eso existe `forwardRef` —
 * ver `forward-ref.ts`). En ese caso `$inject` queda como un getter que
 * recién traduce cuando alguien lo lee de verdad — que en AngularJS pasa al
 * instanciar, momento en el que la clase referida ya está definida. El
 * `string[]` que devuelve esta función en ese caso queda vacío; lo que
 * importa es `target.$inject` (lo que lee AngularJS), no el retorno.
 */
export function ensureInject(target: object): string[] {
  const raw = (target as { $inject?: readonly InjectionEntry[] }).$inject ?? [];

  if (raw.some(isForwardRef)) {
    let cached: string[] | undefined;
    Object.defineProperty(target, "$inject", {
      configurable: true,
      enumerable: true,
      get(): string[] {
        cached ??= ReflectInjection.toInject(raw);
        return cached;
      },
    });
    return [];
  }

  const resolved = ReflectInjection.toInject(raw);
  if (raw.length === resolved.length && raw.every((token, index) => token === resolved[index])) {
    return resolved;
  }

  (target as { $inject?: readonly string[] }).$inject = resolved;
  return resolved;
}
