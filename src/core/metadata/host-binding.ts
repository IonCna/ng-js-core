/** Decorador declarativo; el compilador genera el wiring del host. */
export function HostBinding(hostProperty: string): PropertyDecorator {
  void hostProperty;
  return () => undefined;
}
