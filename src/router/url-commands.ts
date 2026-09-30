type QueryParams = Record<string, unknown>;

/** Lo que `navigate()`/`createUrlTree()` leen de `NavigationExtras`. */
export interface UrlCommandsExtras {
  /** Base de los comandos relativos: su URL (ver `UrlCommands.apply`). */
  relativeTo?: { snapshot?: { url?: unknown } } | null;
  queryParams?: QueryParams | null;
  fragment?: string;
  queryParamsHandling?: "merge" | "preserve" | "" | null;
  preserveFragment?: boolean;
}

/** La URL actual, partida: lo que `UrlCommands` necesita para resolver relativos, `merge`/`preserve` y el fragment. */
export interface CurrentUrl {
  path: string;
  query: Record<string, string | string[]>;
  fragment: string | null;
}

/**
 * Los `commands` de `router.navigate(commands, extras)` como en Angular (`createUrlTree`), sobre URLs de texto:
 * - el primero con `/` es absoluto; si no, relativo a `relativeTo` (sin `relativeTo`, a la raíz, como Angular);
 * - cada string puede traer varios segmentos (`"a/b"`), `".."` sube uno y `"."`/`""` no cambian nada;
 * - un número es un segmento; un objeto (parámetros de matriz, `;k=v`) es error: UI-Router no los separa del
 *   segmento (terminarían adentro del valor de un `:param`);
 * - `queryParams` con `queryParamsHandling` (`merge` suma a los actuales, `preserve` deja los actuales), `fragment`
 *   (o el actual con `preserveFragment`).
 *
 * `relativeTo`: `ngjs-core` tiene un único `ActivatedRoute` (el de la ruta activa más profunda), así que la base
 * relativa es la URL de esa ruta — igual que Angular cuando se navega desde el componente de la ruta activa.
 */
export class UrlCommands {
  static apply(commands: unknown[], extras: UrlCommandsExtras | undefined, current: CurrentUrl): string {
    const first = commands[0];
    const absolute = typeof first === "string" && first.startsWith("/");
    const relative = !absolute && extras?.relativeTo != null;
    const segments = relative ? UrlCommands.split(current.path) : [];

    for (const command of commands) {
      if (command !== null && typeof command === "object") {
        throw new Error(
          `Router.navigate: parámetros de matriz (${JSON.stringify(command)}) no soportados sobre UI-Router — usá queryParams.`,
        );
      }
      for (const part of String(command).split("/")) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
          if (!segments.length) throw new Error(`Router.navigate: "${String(command)}" sube más allá de la raíz.`);
          segments.pop();
          continue;
        }
        segments.push(part);
      }
    }

    const query = UrlCommands.query(extras, current.query);
    const fragment = extras?.fragment ?? (extras?.preserveFragment ? current.fragment : null);
    return `/${segments.join("/")}${query}${fragment ? `#${fragment}` : ""}`;
  }

  /** `"/a/b?x=1#f"` → `["a", "b"]`. */
  private static split(path: string): string[] {
    return path
      .split(/[?#]/)[0]!
      .split("/")
      .filter((segment) => segment !== "");
  }

  private static query(extras: UrlCommandsExtras | undefined, current: Record<string, string | string[]>): string {
    const handling = extras?.queryParamsHandling;
    const params: QueryParams =
      handling === "preserve"
        ? { ...current }
        : handling === "merge"
          ? { ...current, ...extras?.queryParams }
          : { ...extras?.queryParams };
    const pairs = Object.entries(params).flatMap(([key, value]) => {
      if (value === undefined || value === null) return []; // como Angular: `null` saca el param
      const values = Array.isArray(value) ? value : [value];
      return values.map((item) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    });
    return pairs.length ? `?${pairs.join("&")}` : "";
  }
}
