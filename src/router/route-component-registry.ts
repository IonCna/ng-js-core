import angular from "angular";

/**
 * `canDeactivate` (Angular) recibe la **instancia del componente** que se está
 * dejando. UI-Router no la pasa en el hook, así que la sacamos del DOM en el
 * momento del `onExit` — el elemento del route component todavía está montado
 * (el hook corre antes de destruirlo). jqLite guarda el controller en el data
 * del elemento (`$<name>Controller`).
 */
export function resolveRouteComponentInstance(componentCamelName: string): unknown {
  const kebab = componentCamelName.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const element = document.querySelector(kebab);
  if (!element) return undefined;
  const jq = angular.element(element) as unknown as { controller(name?: string): unknown };
  return jq.controller(componentCamelName);
}
