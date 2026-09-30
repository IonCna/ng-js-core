/** La función de `@Input({ transform })`: recibe el valor que llega por el binding y devuelve el que ve la clase. */
// biome-ignore lint/suspicious/noExplicitAny: como Angular — el tipo de entrada lo elige cada transform.
export type InputTransform = (value: any) => unknown;

export interface InputOptions {
  alias?: string;
  /** El compilador de templates exige el atributo en cada uso del selector (error en build, como Angular). */
  required?: boolean;
  /** Se aplica a cada valor que llega por el binding (no al valor inicial del campo), como Angular 16.1. */
  transform?: InputTransform;
  /** Propio de ngjs: `"@"` es el binding de interpolación de AngularJS (`label="Hola {{ x }}"`). */
  binding?: "<" | "@";
}

/** Decorador declarativo; `ng-js-compiler` lee y elimina su uso durante el build. */
export function Input(aliasOrOptions?: string | InputOptions): PropertyDecorator {
  void aliasOrOptions;
  return () => undefined;
}

/**
 * `@Input({ transform: booleanAttribute })`: como Angular, un atributo presente sin valor (`""`) es `true` y el string
 * `"false"` es `false`.
 */
export function booleanAttribute(value: unknown): boolean {
  return typeof value === "boolean" ? value : value != null && `${value}` !== "false";
}

/** `@Input({ transform: numberAttribute })`: como Angular, lo que no es un número da `fallbackValue` (`NaN`). */
export function numberAttribute(value: unknown, fallbackValue = Number.NaN): number {
  const isNumber = !Number.isNaN(Number.parseFloat(value as string)) && !Number.isNaN(Number(value));
  return isNumber ? Number(value) : fallbackValue;
}
