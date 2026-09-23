/** Opciones de autoría que entiende `@Injectable`. */
export interface InjectableOptions {
  providedIn?: "root";
  useClass?: Function;
  useValue?: unknown;
  useFactory?: (...args: never[]) => unknown;
  useExisting?: unknown;
  deps?: readonly unknown[];
}

/**
 * Decorador de autoría para `@Injectable`.
 *
 * El compilador resuelve el constructor y genera `ɵfac`/`ɵprov`. El decorador
 * no asigna nombres DI, no aplica reflection y no registra providers.
 */
export function Injectable(_options?: InjectableOptions): ClassDecorator {
  return (target) => target;
}
