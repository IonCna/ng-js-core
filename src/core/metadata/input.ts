import { addInputDef } from "@/core/metadata/store.ts";

export interface InputOptions {
  required?: boolean;
  alias?: string;
  transform?: (value: unknown) => unknown;
}

/**
 * Decorador de propiedad — corre una vez al definir la clase, sobre un campo
 * YA declarado (`@Input() count = 0`). No resuelve nada por su cuenta, solo
 * anota `{propName, bindingName, required?}` en el bucket (`store.ts`);
 * `@Component`/`@Directive` lo leen al final para armar `inputs[]`.
 */
export function Input(aliasOrOptions?: string | InputOptions): PropertyDecorator {
  return (target, propertyKey) => {
    const options = typeof aliasOrOptions === "string" ? { alias: aliasOrOptions } : aliasOrOptions;
    addInputDef(target, {
      propName: String(propertyKey),
      bindingName: options?.alias ?? String(propertyKey),
      required: options?.required,
      transform: options?.transform,
    });
  };
}
