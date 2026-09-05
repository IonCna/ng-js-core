import { addHostBindingDef } from "@/core/metadata/store.ts";

/** Decorador de propiedad — anota `{propName, hostProperty}` en el bucket, nada más. El wiring real ($scope.$watch + reflejo al DOM) es del controller-bridge (etapa 5). */
export function HostBinding(hostProperty: string): PropertyDecorator {
  return (target, propertyKey) => {
    addHostBindingDef(target, { propName: String(propertyKey), hostProperty });
  };
}
