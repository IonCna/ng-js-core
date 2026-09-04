import { addInputDef } from "@/core/metadata/store.ts";

export interface ModelOptions {
  required?: boolean;
  alias?: string;
}

/**
 * Decorador de propiedad — equivalente a `@Input` pero anota `twoWay: true`
 * (binding `'='` de AngularJS). Sin `@Output` aparte: AngularJS sincroniza
 * los dos lados solo, no hace falta emitir nada a mano.
 */
export function Model(aliasOrOptions?: string | ModelOptions): PropertyDecorator {
  return (target, propertyKey) => {
    const options = typeof aliasOrOptions === "string" ? { alias: aliasOrOptions } : aliasOrOptions;
    addInputDef(target, {
      propName: String(propertyKey),
      bindingName: options?.alias ?? String(propertyKey),
      required: options?.required,
      twoWay: true,
    });
  };
}
