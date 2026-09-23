export interface InputOptions {
  alias?: string;
  required?: boolean;
  transform?: (value: unknown) => unknown;
  binding?: "<" | "@";
}

/** Decorador declarativo; `ng-js-compiler` lee y elimina su uso durante el build. */
export function Input(aliasOrOptions?: string | InputOptions): PropertyDecorator {
  void aliasOrOptions;
  return () => undefined;
}
