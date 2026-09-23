export interface OutputOptions {
  alias?: string;
}

/** Decorador declarativo; `ng-js-compiler` lee y elimina su uso durante el build. */
export function Output(aliasOrOptions?: string | OutputOptions): PropertyDecorator {
  void aliasOrOptions;
  return () => undefined;
}
