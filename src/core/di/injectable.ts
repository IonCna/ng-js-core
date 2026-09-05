import { applyConstructorInject, setInjectOverride } from "@/core/di/ctor-inject.ts";
import { deriveInjectableName, setInjectableId as setRegisteredInjectableId } from "@/core/di/injectable-registry.ts";
import type { ProviderToken } from "@/core/di/provider-token.ts";

export { setInjectOverride };

export interface InjectableOptions {
  id?: string;
  providedIn?: "root";
}

export interface InjectableDefinition<T extends object> extends InjectableOptions {
  value: T;
}

/**
 * Estampa la clave de registro AngularJS (`$name`) de un `@Injectable`. Con `id`
 * explícito usa ese; sin `id`, la deriva de `Clase.name`. Un `static $name` propio
 * ya declarado se respeta y no se pisa (compat con clases estilo AngularJS puro).
 */
function stampInjectableName(target: object, options?: InjectableOptions): void {
  if (options?.id) {
    setRegisteredInjectableId(target, options.id);
    (target as { $name?: string }).$name = options.id;
    return;
  }
  if (!Object.hasOwn(target, "$name")) {
    (target as { $name?: string }).$name = deriveInjectableName(target as Function);
  }
}

export function injectable<T extends object>(target: T, options?: InjectableOptions): T;
export function injectable<T extends object>(definition: InjectableDefinition<T>): T;
export function injectable<T extends object>(
  targetOrDefinition: T | InjectableDefinition<T>,
  options?: InjectableOptions,
): T {
  const target = "value" in targetOrDefinition ? targetOrDefinition.value : targetOrDefinition;
  const resolvedOptions = "value" in targetOrDefinition ? targetOrDefinition : options;

  stampInjectableName(target, resolvedOptions);
  applyConstructorInject(target as unknown as Function);
  return target;
}

export function Inject(token: ProviderToken<unknown> | string): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    setInjectOverride(target as unknown as Function, parameterIndex, token);
  };
}

export function Injectable(config?: InjectableOptions): ClassDecorator {
  return (target) => {
    const ctor = target as unknown as Function;
    stampInjectableName(ctor, config);
    applyConstructorInject(ctor);
  };
}
