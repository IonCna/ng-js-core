/** Decorador declarativo para leer un atributo estático del host en build. */
export function Attribute(name: string): ParameterDecorator {
  void name;
  return () => undefined;
}
