export interface InjectFlags {
  optional?: boolean;
  self?: boolean;
  skipSelf?: boolean;
  host?: boolean;
}

/** Decoradores declarativos; `ng-js-compiler` convierte estos flags en `ɵresolve`. */
export function Optional(): ParameterDecorator {
  return () => undefined;
}

export function Self(): ParameterDecorator {
  return () => undefined;
}

export function SkipSelf(): ParameterDecorator {
  return () => undefined;
}

export function Host(): ParameterDecorator {
  return () => undefined;
}
