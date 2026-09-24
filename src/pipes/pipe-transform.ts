/**
 * Contrato de un `@Pipe`. El registro como `.filter()` de AngularJS lo emite `ng-js-compiler` (instancia con su
 * `ɵfac` y delega en `transform`; `pure: false` → filtro `$stateful`).
 */
export interface PipeTransform<T = unknown, R = unknown> {
  transform(value: T, ...args: unknown[]): R;
}
