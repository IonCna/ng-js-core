import { addHostListenerDef } from "@/core/metadata/store.ts";

/** Decorador de método — anota `{methodName, eventName, args?}` en el bucket, nada más. El wiring real ($element.nativeElement.addEventListener) es del controller-bridge (etapa 5). */
export function HostListener(eventName: string, args?: string[]): MethodDecorator {
  return (target, propertyKey) => {
    addHostListenerDef(target, { methodName: String(propertyKey), eventName, args });
  };
}
