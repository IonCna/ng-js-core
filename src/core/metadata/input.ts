import { addInputDef } from "@/core/metadata/store.ts";

export interface InputOptions {
  required?: boolean;
  alias?: string;
  transform?: (value: unknown) => unknown;
  /**
   * Modo de binding de AngularJS bajo el que se registra este input. Default
   * `"<"` (expresión one-way, = `@Input()` de Angular con `[attr]="expr"`).
   *
   * `"@"` → el atributo se toma como **string literal / interpolación**
   * (`attr="texto"`, `attr="{{ x }}"`), como `@Input()` de Angular con
   * `attr="valor"`. Útil para inputs que SIEMPRE reciben strings (`placement`,
   * `type`, `tooltipClass`, …) — así no hace falta escribir `attr="'texto'"`.
   * Un input `string | TemplateRef` (que necesita las dos formas) se deja en
   * `"<"` y el string se pasa entrecomillado.
   */
  binding?: "<" | "@";
}

/**
 * Decorador de propiedad — corre una vez al definir la clase, sobre un campo
 * YA declarado (`@Input() count = 0`). No resuelve nada por su cuenta, solo
 * anota `{propName, bindingName, required?}` en el bucket (`store.ts`);
 * `@Component`/`@Directive` lo leen al final para armar `inputs[]`.
 */
export function Input(aliasOrOptions?: string | InputOptions): PropertyDecorator {
  return (target, propertyKey) => {
    const options = typeof aliasOrOptions === "string" ? { alias: aliasOrOptions } : aliasOrOptions;
    addInputDef(target, {
      propName: String(propertyKey),
      bindingName: options?.alias ?? String(propertyKey),
      required: options?.required,
      transform: options?.transform,
      binding: options?.binding,
    });
  };
}
