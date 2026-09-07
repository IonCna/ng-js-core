/**
 * `selector → nombre de registro AngularJS` (camelCase). Un `[attr]` pierde los
 * corchetes; `mi-cosa` y `[miCosa]` caen los dos en `miCosa`. Es la MISMA clave
 * con la que `registerDeclaration`/`createComponent` registran la directiva, y
 * ahora también el `id` inyectable de la clase `@Component`/`@Directive` (para
 * que un descendiente pueda `inject(MiCosa)` y reciba la instancia ancestro).
 */
export function stripAttributeSelector(selector: string): string {
  return selector.startsWith("[") && selector.endsWith("]") ? selector.slice(1, -1) : selector;
}

export function toCamelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

export function toKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export function selectorToRegistrationName(selector: string): string {
  return parseSelector(selector).registrationName;
}

export interface ParsedSelector {
  /** Nombre con que AngularJS dispara la directiva (`.directive()`/`.component()`), en camelCase. */
  registrationName: string;
  /** `'A'` si dispara por atributo, `'E'` si dispara por tag — AngularJS no distingue más fino que esto. */
  restrict: "A" | "E";
  /**
   * Selector CSS (atributos en kebab-case) para afinar con `Element.matches()` en
   * `compile()` — `undefined` si el selector simple ya alcanza (bare tag o bare
   * `[attr]`, sin nada para afinar). Cubre lo que AngularJS no puede expresar con
   * `restrict`/nombre solos: compuestos (`button[ngbNavLink]`) y pseudo-clases
   * (`:not(...)`). Ver nota en `ng-module-runtime.ts` sobre el límite real: esto
   * evita que el `link`/`compile`/host-bindings de la directiva actúen en un
   * elemento que no matchea, pero AngularJS igual construye el controller (no hay
   * forma de evitarlo desde afuera del compilador — a diferencia de Angular real,
   * que sí filtra por selector completo antes de instanciar nada).
   */
  refine?: string;
}

// `[\w$-]` (con guión) — un selector puede escribir el atributo en kebab-case
// (`[child-dir]`, como en AngularJS) o camelCase (`[ngbNavLink]`, como Angular real).
const ATTRIBUTE_NAME_RE = /\[([A-Za-z_$][\w$-]*)/g;

/** Saca el contenido de pseudo-clases (`:not(...)`) — sus atributos no cuentan como disparador, solo afinan. */
function stripPseudoClassArgs(selector: string): string {
  return selector.replace(/:[A-Za-z-]+\([^()]*\)/g, "");
}

function splitTopLevelCommas(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function leadingTagOf(branch: string): string | undefined {
  return branch.match(/^([A-Za-z][\w-]*)/)?.[1];
}

function attributeNamesIn(selector: string): string[] {
  return [...selector.matchAll(ATTRIBUTE_NAME_RE)].map((match) => match[1]);
}

function kebabCaseAttributesIn(selector: string): string {
  return selector.replace(ATTRIBUTE_NAME_RE, (_match, name: string) => `[${toKebabCase(name)}`);
}

/**
 * Parsea un selector de `@Component`/`@Directive` (sintaxis CSS, como en Angular
 * real) a lo que AngularJS necesita para registrar la directiva: bajo qué nombre
 * (`registrationName`), con qué `restrict`, y — si el selector es más que eso —
 * un selector CSS (`refine`) para afinar contra el elemento real en `compile()`.
 *
 * Soporta: tag simple (`mi-cosa`), atributo simple (`[miCosa]`), compuestos
 * (`button[ngbNavLink]`), pseudo-clases (`[ngbNavLink]:not([disabled])`) y listas
 * separadas por coma (`a[ngbNavLink], button[ngbNavLink]`) — siempre que TODAS
 * las ramas de la lista compartan el mismo nombre de atributo disparador (si no,
 * no hay un único nombre bajo el cual registrar en AngularJS y se tira error:
 * hay que partir en varias `@Directive`).
 */
export function parseSelector(selector: string): ParsedSelector {
  const trimmed = selector.trim();
  const branches = splitTopLevelCommas(trimmed);

  // Para decidir el disparador (nombre/tag) se ignora lo que haya dentro de
  // `:not(...)` — eso solo afina (`refine`, más abajo), no es un segundo atributo.
  const forTrigger = stripPseudoClassArgs(trimmed);
  const branchesForTrigger = splitTopLevelCommas(forTrigger);
  const attributeNames = new Set(attributeNamesIn(forTrigger));

  let registrationName: string;
  let restrict: "A" | "E";

  if (attributeNames.size === 1) {
    registrationName = toCamelCase([...attributeNames][0]);
    restrict = "A";
  } else if (attributeNames.size === 0) {
    const tags = new Set(branchesForTrigger.map(leadingTagOf));
    if (tags.size !== 1 || tags.has(undefined)) {
      throw new Error(
        `parseSelector: "${selector}" no tiene un único tag/atributo disparador — separalo en varias @Directive/@Component.`,
      );
    }
    registrationName = toCamelCase([...tags][0] as string);
    restrict = "E";
  } else {
    throw new Error(
      `parseSelector: "${selector}" combina varios nombres de atributo distintos (${[...attributeNames].join(", ")}) — AngularJS solo puede registrar bajo uno. Separalo en varias @Directive.`,
    );
  }

  const isBareSelector =
    branches.length === 1 &&
    (restrict === "E" ? /^[A-Za-z][\w-]*$/.test(branches[0]) : /^\[[A-Za-z_$][\w$-]*\]$/.test(branches[0]));
  const refine = isBareSelector ? undefined : kebabCaseAttributesIn(trimmed);

  return { registrationName, restrict, refine };
}
