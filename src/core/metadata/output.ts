import { addOutputDef } from "@/core/metadata/store.ts";

/** Decorador de propiedad — anota `{propName, bindingName}` en el bucket, nada más. */
export function Output(alias?: string): PropertyDecorator {
  return (target, propertyKey) => {
    addOutputDef(target, {
      propName: String(propertyKey),
      bindingName: alias ?? String(propertyKey),
    });
  };
}
