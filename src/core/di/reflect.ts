import { InjectionToken } from "@/core/di/injection-token.ts";
import type { AbstractType, ProviderToken, Type } from "@/core/di/provider-token.ts";

export type InjectionEntry = ProviderToken<unknown> | string;

function isInjectionToken(token: unknown): token is InjectionToken<unknown> {
  return token instanceof InjectionToken;
}

function isNamedType(token: unknown): token is Type<unknown> | AbstractType<unknown> {
  return typeof token === "function" && typeof (token as { $name?: unknown }).$name === "string";
}

export class ReflectInjection {
  static translate(token: InjectionEntry): string {
    if (typeof token === "string") {
      return token;
    }

    if (isInjectionToken(token)) {
      return token.toString();
    }

    if (isNamedType(token)) {
      return token.$name;
    }

    throw new Error(
      `ReflectInjection: no se pudo resolver el token "${String(token)}" a un nombre de $inject. ` +
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
 */
export function ensureInject(target: object): string[] {
  const raw = (target as { $inject?: readonly InjectionEntry[] }).$inject ?? [];
  const resolved = ReflectInjection.toInject(raw);
  (target as { $inject?: readonly string[] }).$inject = resolved;
  return resolved;
}
