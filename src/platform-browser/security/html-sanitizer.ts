import { sanitizeSrcset, sanitizeUrl } from "@/platform-browser/security/url-sanitizer.ts";

/**
 * Sanitizador de HTML — port de `@angular/core` (`sanitization/html_sanitizer.ts`).
 * Parsea a un DOM inerte (`DOMParser`, con fallback a `<template>`), recorre el
 * árbol contra un allowlist de tags/atributos, saneando las URIs y escapando
 * texto. Output byte-idéntico al de `DomSanitizer.sanitize(HTML, …)` de Angular.
 * No usa `ngSanitize`.
 */

function tagSet(...sets: string[]): Record<string, true> {
  const out: Record<string, true> = {};
  for (const set of sets) for (const t of set.split(",")) out[t] = true;
  return out;
}
function merge(...sets: Record<string, true>[]): Record<string, true> {
  return Object.assign({}, ...sets);
}

const VOID_ELEMENTS = tagSet("area,br,col,hr,img,wbr");

const OPTIONAL_END_TAG_BLOCK_ELEMENTS = tagSet("colgroup,dd,dt,li,p,tbody,td,tfoot,th,thead,tr");
const OPTIONAL_END_TAG_INLINE_ELEMENTS = tagSet("rp,rt");
const OPTIONAL_END_TAG_ELEMENTS = merge(OPTIONAL_END_TAG_INLINE_ELEMENTS, OPTIONAL_END_TAG_BLOCK_ELEMENTS);

const BLOCK_ELEMENTS = merge(
  OPTIONAL_END_TAG_BLOCK_ELEMENTS,
  tagSet(
    "address,article,aside,blockquote,caption,center,del,details,dialog,dir,div,dl," +
      "figcaption,figure,footer,h1,h2,h3,h4,h5,h6,header,hgroup,hr,ins,main,map,menu,nav,ol," +
      "pre,section,summary,table,ul",
  ),
);
const INLINE_ELEMENTS = merge(
  OPTIONAL_END_TAG_INLINE_ELEMENTS,
  tagSet(
    "a,abbr,acronym,audio,b,bdi,bdo,big,br,cite,code,del,dfn,em,font,i,img,ins,kbd,label," +
      "map,mark,picture,q,ruby,rp,rt,s,samp,small,source,span,strike,strong,sub,sup,time," +
      "track,tt,u,var,video",
  ),
);

const VALID_ELEMENTS = merge(
  VOID_ELEMENTS,
  BLOCK_ELEMENTS,
  INLINE_ELEMENTS,
  OPTIONAL_END_TAG_ELEMENTS,
);

// Atributos-URI (se sanean con `sanitizeUrl`).
const URI_ATTRS = tagSet("background,cite,href,itemtype,longdesc,poster,src,xlink:href");

const HTML_ATTRS = tagSet(
  "abbr,accesskey,align,alt,axis,bgcolor,border,cellpadding,cellspacing,class,clear,color," +
    "cols,colspan,compact,coords,datetime,default,dir,download,face,headers,height,hidden," +
    "hreflang,hspace,ismap,itemscope,itemprop,kind,label,lang,language,loop,media,muted,nohref," +
    "nowrap,open,preload,rel,rev,role,rows,rowspan,rules,scope,scrolling,shape,size,sizes,span," +
    "srclang,srcset,start,summary,tabindex,target,title,translate,type,usemap,valign,value," +
    "vspace,width",
);

const VALID_ATTRS = merge(URI_ATTRS, HTML_ATTRS);

// No recorrer el contenido de estos si el tag en sí es inválido.
const SKIP_TRAVERSING_CONTENT_IF_INVALID_ELEMENTS = tagSet("script,style,template");

// Nota: como en Angular, `aria-*` y `data-*` NO están en el allowlist — se strippean.

const SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
// Cualquier carácter no imprimible-ASCII → entidad numérica.
const NON_ALPHANUMERIC_REGEXP = /([^#-~ |!])/g;

function encodeEntities(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(SURROGATE_PAIR_REGEXP, (match) => {
      const hi = match.charCodeAt(0);
      const low = match.charCodeAt(1);
      return `&#${(hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000};`;
    })
    .replace(NON_ALPHANUMERIC_REGEXP, (match) => `&#${match.charCodeAt(0)};`)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Protección contra DOM clobbering (`@angular/core` `checkClobberedElement`): si
 * el "siguiente" nodo resulta estar CONTENIDO en `node`, es que un atributo
 * `nextSibling`/`firstChild` pisó la propiedad → abortar.
 */
function assertNotClobbered(node: Node, next: Node | null): Node | null {
  if (
    next &&
    (node.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_CONTAINED_BY) ===
      Node.DOCUMENT_POSITION_CONTAINED_BY
  ) {
    throw new Error("Failed to sanitize html because the element is clobbered");
  }
  return next;
}

class SanitizingHtmlSerializer {
  private readonly buf: string[] = [];

  sanitizeChildren(el: Element): string {
    let current: Node | null = el.firstChild;
    let traverse = true;
    const parents: Node[] = [];

    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        traverse = this.startElement(current as Element);
      } else if (current.nodeType === Node.TEXT_NODE) {
        this.buf.push(encodeEntities(current.nodeValue ?? ""));
      }

      if (traverse && current.firstChild) {
        parents.push(current);
        current = current.firstChild;
        continue;
      }

      while (current) {
        if (current.nodeType === Node.ELEMENT_NODE) this.endElement(current as Element);
        const next = assertNotClobbered(current, current.nextSibling);
        if (next) {
          current = next;
          break;
        }
        current = assertNotClobbered(current, parents.pop() ?? null);
      }
    }
    return this.buf.join("");
  }

  private startElement(element: Element): boolean {
    const tagName = element.nodeName.toLowerCase();
    if (VALID_ELEMENTS[tagName] !== true) {
      return SKIP_TRAVERSING_CONTENT_IF_INVALID_ELEMENTS[tagName] !== true;
    }
    this.buf.push("<", tagName);
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name;
      const lower = name.toLowerCase();
      if (VALID_ATTRS[lower] !== true) continue;
      let value = attr.value;
      if (URI_ATTRS[lower]) value = sanitizeUrl(value);
      else if (lower === "srcset") value = sanitizeSrcset(value);
      this.buf.push(" ", name, '="', encodeEntities(value), '"');
    }
    this.buf.push(">");
    return true;
  }

  private endElement(element: Element): void {
    const tagName = element.nodeName.toLowerCase();
    if (VALID_ELEMENTS[tagName] === true && VOID_ELEMENTS[tagName] !== true) {
      this.buf.push("</", tagName, ">");
    }
  }
}

function inertBody(doc: Document, html: string): HTMLElement {
  // `DOMParser` primero (más rápido y aislado); fallback a `<template>`.
  try {
    const parsed = new DOMParser().parseFromString(`<body><remove></remove>${html}`, "text/html").body;
    if (parsed) {
      parsed.firstChild?.remove();
      return parsed;
    }
  } catch {
    /* cae al <template> */
  }
  const tpl = doc.createElement("template");
  tpl.innerHTML = html;
  return tpl.content as unknown as HTMLElement;
}

export function sanitizeHtml(doc: Document, unsafeHtmlInput: string): string {
  let unsafeHtml = unsafeHtmlInput ? String(unsafeHtmlInput) : "";
  let body = inertBody(doc, unsafeHtml);

  // Protección mXSS: re-parsear hasta que el HTML sea estable (máx 5).
  let attempts = 5;
  let parsedHtml = body.innerHTML;
  while (unsafeHtml !== parsedHtml) {
    if (attempts-- === 0) throw new Error("Failed to sanitize html because the input is unstable");
    unsafeHtml = parsedHtml;
    body = inertBody(doc, unsafeHtml);
    parsedHtml = body.innerHTML;
  }

  const result = new SanitizingHtmlSerializer().sanitizeChildren(body);
  while (body.firstChild) body.firstChild.remove();
  return result;
}
