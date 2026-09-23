/** Opciones declarativas de un `InjectionToken`. Las consume el compilador. */
export interface InjectionTokenOptions<T> {
  providedIn?: "root";
  factory?: () => T;
}

/**
 * Token nominal para DI.
 *
 * La instancia no genera nombres, no mantiene un contador y no se registra en
 * ningún injector. `ng-js-compiler` calcula el nombre estable del símbolo y
 * estampa `TOKEN.ɵprov` después de leer el código fuente.
 */
export class InjectionToken<T> {
  declare readonly _type: T;

  constructor(
    readonly description: string,
    readonly options?: InjectionTokenOptions<T>,
  ) {}

  toString(): string {
    return this.description;
  }
}
