import { RootSingletonRegistry } from "@/core/di/root-singleton-registry.ts";

class InjectionTokenCounter {
  private static _count = 0;

  static get count() {
    return InjectionTokenCounter._count;
  }

  static increment() {
    InjectionTokenCounter._count++;
    return InjectionTokenCounter._count;
  }
}

export interface InjectionTokenOptions<T> {
  /** Se usa solo si nadie más provee el token (ni `providers`, ni `$injector` nativo). */
  readonly factory: () => T;
  /**
   * Solo `'root'` (como en `@Injectable`/`@Service` — ver `root-singleton-registry.ts`):
   * no hay otro nivel implementado todavía (`'platform'`/`'any'`/módulo de Angular
   * real no tienen equivalente acá). Puramente informativo hoy — un `factory` ya
   * se comporta como root singleton exista o no esta opción; se acepta para que
   * el código que trae `{ providedIn: 'root', factory }` de Angular real compile tal cual.
   */
  readonly providedIn?: "root";
}

export class InjectionToken<T> {
  private readonly _id: string;
  private declare readonly _type: T;
  readonly factory?: () => T;

  constructor(desc: string, options?: InjectionTokenOptions<T>) {
    this._id = `${desc}-${InjectionTokenCounter.increment()}`;
    this.factory = options?.factory;
    // Root singleton lazy, como `providedIn: 'root'` — se construye recién la
    // primera vez que alguien lo pide y nadie más lo proveyó (ver `root-singleton-registry.ts`).
    if (this.factory) RootSingletonRegistry.register(this._id, this.factory);
  }

  toString() {
    return this._id;
  }
}
