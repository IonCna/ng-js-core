import type { InputDef, OutputDef } from "@/core/metadata/def.ts";

/**
 * Traduce `inputs[]`/`outputs[]` normalizados al objeto `bindings` de
 * `IComponentOptions` de AngularJS. La clave es SIEMPRE la propiedad del
 * controller (`propName`); el valor es el modo (`<`/`=`/`&`), un `?` salvo que
 * el input sea `required`, y el nombre del atributo solo si difiere del de la
 * propiedad.
 *
 *   `@Input() count`                  → `{ count: '<?' }`
 *   `@Input({ required: true }) step` → `{ step: '<' }`
 *   `@Input('data') items`            → `{ items: '<?data' }`
 *   `@Output() closed`               → `{ closed: '&?' }`
 *   `@Model() total`                 → `{ total: '=?' }`
 */
export function bindingsFromDefs(inputs: InputDef[], outputs: OutputDef[]): Record<string, string> {
  const bindings: Record<string, string> = {};
  for (const input of inputs) bindings[input.propName] = bindingExpr(input.twoWay ? "=" : "<", input);
  for (const output of outputs) bindings[output.propName] = bindingExpr("&", output);
  return bindings;
}

function bindingExpr(mode: string, def: { propName: string; bindingName: string; required?: boolean }): string {
  const optional = def.required ? "" : "?";
  const alias = def.bindingName === def.propName ? "" : def.bindingName;
  return `${mode}${optional}${alias}`;
}
