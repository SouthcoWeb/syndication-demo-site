/**
 * Small non-validating XML parser for the parts of an .xlsx package. Namespace
 * prefixes are dropped from element names (`x:row` → `row`), which some
 * generators (e.g. the Open XML SDK) use.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

/** XML entities, plus common HTML ones that rich-text PIM fields carry inside cell text. */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  reg: "®",
  trade: "™",
  copy: "©",
  deg: "°",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  middot: "·",
  times: "×",
  plusmn: "±",
  micro: "µ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity] ?? match;
  });
}

const localName = (qualified: string) => qualified.slice(qualified.indexOf(":") + 1);

/** Index of the ">" closing the tag that starts at `start`, ignoring ">" inside quoted attribute values. */
function tagEnd(xml: string, start: number): number {
  let quote = "";
  for (let i = start + 1; i < xml.length; i++) {
    const c = xml[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i;
    }
  }
  return xml.length;
}

const ATTRIBUTE = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: "#document", attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    const end = lt === -1 ? xml.length : lt;
    if (end > i) {
      const text = xml.slice(i, end);
      // Whitespace between elements is noise, except inside text elements.
      const parent = stack[stack.length - 1];
      if (text.trim() || parent.name === "t") parent.children.push(decodeEntities(text));
    }
    if (lt === -1) break;

    if (xml.startsWith("<!--", lt)) {
      const close = xml.indexOf("-->", lt + 4);
      i = close === -1 ? xml.length : close + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const close = xml.indexOf("]]>", lt + 9);
      stack[stack.length - 1].children.push(xml.slice(lt + 9, close === -1 ? xml.length : close));
      i = close === -1 ? xml.length : close + 3;
      continue;
    }
    const gt = tagEnd(xml, lt);
    if (xml[lt + 1] === "?" || xml[lt + 1] === "!") {
      i = gt + 1;
      continue;
    }
    if (xml[lt + 1] === "/") {
      if (stack.length > 1) stack.pop();
      i = gt + 1;
      continue;
    }

    const selfClosing = xml[gt - 1] === "/";
    const inner = xml.slice(lt + 1, selfClosing ? gt - 1 : gt);
    const nameMatch = /^[^\s/>]+/.exec(inner);
    const element: XmlElement = { name: localName(nameMatch ? nameMatch[0] : ""), attrs: {}, children: [] };
    ATTRIBUTE.lastIndex = nameMatch ? nameMatch[0].length : 0;
    for (let m = ATTRIBUTE.exec(inner); m; m = ATTRIBUTE.exec(inner)) {
      const value = decodeEntities(m[2] ?? m[3] ?? "");
      element.attrs[m[1]] = value;
      const local = localName(m[1]);
      if (!(local in element.attrs)) element.attrs[local] = value;
    }
    stack[stack.length - 1].children.push(element);
    if (!selfClosing) stack.push(element);
    i = gt + 1;
  }
  return root;
}

export function childElements(element: XmlElement, name?: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (const child of element.children) if (typeof child !== "string" && (!name || child.name === name)) out.push(child);
  return out;
}

export function firstChild(element: XmlElement, name: string): XmlElement | undefined {
  for (const child of element.children) if (typeof child !== "string" && child.name === name) return child;
  return undefined;
}

/** All descendants with this name, in document order. */
export function descendants(element: XmlElement, name: string, out: XmlElement[] = []): XmlElement[] {
  for (const child of element.children) {
    if (typeof child === "string") continue;
    if (child.name === name) out.push(child);
    descendants(child, name, out);
  }
  return out;
}

/** Concatenated text of an element, optionally skipping some subtrees (e.g. phonetic runs). */
export function textContent(element: XmlElement, skip?: Set<string>): string {
  let text = "";
  for (const child of element.children) {
    if (typeof child === "string") text += child;
    else if (!skip?.has(child.name)) text += textContent(child, skip);
  }
  return text;
}
