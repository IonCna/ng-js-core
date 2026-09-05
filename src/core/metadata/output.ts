import { addOutputDef } from "@/core/metadata/store.ts";

export interface OutputOptions {
  alias?: string;
}

/** Decorador de propiedad — anota `{propName, bindingName}` en el bucket, nada más. */
export function Output(aliasOrOptions?: string | OutputOptions): PropertyDecorator {
  return (target, propertyKey) => {
    const options = typeof aliasOrOptions === "string" ? { alias: aliasOrOptions } : aliasOrOptions;
    addOutputDef(target, {
      propName: String(propertyKey),
      bindingName: options?.alias ?? String(propertyKey),
    });
  };
}
