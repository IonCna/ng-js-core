/** Decorador declarativo; el compilador genera el listener del host. */
export function HostListener(eventName: string, args?: string[]): MethodDecorator {
  void eventName;
  void args;
  return () => undefined;
}
