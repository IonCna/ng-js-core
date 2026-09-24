import type { CompiledQueryDef } from "@/core/metadata/compiled-type.ts";
import { QueryList } from "@/core/queries/query-list.ts";

/**
 * Una query instalada en un controller, armada desde su definición compilada (`ɵcmp.queries`/`viewQueries`). El
 * campo de la instancia pasa a ser un getter de `value`; `ViewQueryRegistry` la resuelve.
 */
export abstract class Query {
  constructor(readonly def: CompiledQueryDef) {}

  /** Una clase, o nombres de `#ref`/`ng-ref`. */
  get predicate(): Function | string[] {
    return this.def.predicate;
  }

  get read(): unknown {
    return this.def.read;
  }

  get descendants(): boolean {
    return this.def.descendants;
  }

  abstract readonly value: unknown;
  abstract resolve(values: unknown[]): void;
  abstract destroy(): void;

  static from(def: CompiledQueryDef): Query {
    return def.first ? new SingleQuery(def) : new ListQuery(def);
  }
}

/** `@ViewChild`/`@ContentChild`: el primer resultado (o `undefined`). */
export class SingleQuery extends Query {
  private current: unknown;

  get value(): unknown {
    return this.current;
  }

  resolve(values: unknown[]): void {
    this.current = values[0];
  }

  destroy(): void {}
}

/**
 * `@ViewChildren`/`@ContentChildren`: un `QueryList`. Antes del primer `resolve()` (que corre al entrar a
 * `ngAfterViewInit`/`ngAfterContentInit`) el campo vale `undefined`, como en Angular — así las guardias de "¿ya
 * inicialicé?" (`if (!this.items)`) andan igual.
 */
export class ListQuery extends Query {
  private readonly list = new QueryList<unknown>();
  private resolved = false;

  get value(): unknown {
    return this.resolved ? this.list : undefined;
  }

  resolve(values: unknown[]): void {
    this.resolved = true;
    this.list.reset(values);
    this.list.notifyOnChanges();
  }

  destroy(): void {
    this.list.destroy();
  }
}
