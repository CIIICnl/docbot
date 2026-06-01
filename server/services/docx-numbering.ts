/**
 * DOCX heading auto-numbering reconstruction
 *
 * Word renders heading numbers (e.g. "1.", "2.5") from a multilevel list
 * definition bound to the heading styles - the digits are NOT stored as text,
 * so mammoth's text extraction drops them. This module reads the numbering
 * straight from the .docx XML (honouring per-paragraph `numId="0"` suppression)
 * and bakes the computed numbers back into the markdown headings, so that
 * cross-references in the body ("see section 2.5") still resolve.
 */

import JSZip from 'jszip';
import { decodeHtmlEntities } from '../utils/html.js';

export interface HeadingNumber {
  level: number; // 1-6 (heading level)
  label: string | null; // computed number e.g. "2.5", or null when unnumbered
  text: string; // heading text (for order-matching against the markdown)
}

interface LevelDef {
  numFmt: string;
  lvlText: string;
  start: number;
}

interface StyleInfo {
  level: number;
  numId: string | null;
  ilvl: number;
}

function firstMatch(re: RegExp, s: string): string | null {
  const m = re.exec(s);
  return m && m[1] != null ? m[1] : null;
}

/** Map a heading-style name/id to a heading level (1-6). */
function levelFromStyle(name: string | null, styleId: string, outlineLvl: string | null): number | null {
  const fromName = name && /(?:heading|kop|titre|überschrift)\s*(\d)/i.exec(name);
  if (fromName && fromName[1]) return parseInt(fromName[1], 10);
  const fromId = /^(?:heading|kop)(\d)$/i.exec(styleId);
  if (fromId && fromId[1]) return parseInt(fromId[1], 10);
  if (outlineLvl != null) return parseInt(outlineLvl, 10) + 1;
  return null;
}

function formatCounter(n: number, numFmt: string): string {
  switch (numFmt) {
    case 'lowerLetter':
      return String.fromCharCode(96 + ((n - 1) % 26) + 1);
    case 'upperLetter':
      return String.fromCharCode(64 + ((n - 1) % 26) + 1);
    case 'lowerRoman':
      return toRoman(n).toLowerCase();
    case 'upperRoman':
      return toRoman(n);
    case 'decimal':
    default:
      return String(n);
  }
}

function toRoman(num: number): string {
  const map: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = num;
  let out = '';
  for (const [v, sym] of map) {
    while (n >= v) { out += sym; n -= v; }
  }
  return out || String(num);
}

/**
 * Extract the ordered heading-number sequence from a .docx buffer.
 * Returns [] if the numbering can't be read (caller then skips numbering).
 */
export async function extractHeadingNumbers(buffer: Buffer): Promise<HeadingNumber[]> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) return [];
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) || '';
  const numberingXml = (await zip.file('word/numbering.xml')?.async('string')) || '';

  // styleId -> { level, numId, ilvl } for heading styles only
  const styles = new Map<string, StyleInfo>();
  const styleRe = /<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g;
  let sm: RegExpExecArray | null;
  while ((sm = styleRe.exec(stylesXml))) {
    const styleId = sm[1] ?? '';
    const body = sm[2] ?? '';
    const name = firstMatch(/<w:name\s+w:val="([^"]+)"/, body);
    const outlineLvl = firstMatch(/<w:outlineLvl\s+w:val="(\d+)"/, body);
    const level = levelFromStyle(name, styleId, outlineLvl);
    if (level == null || level < 1 || level > 6) continue;
    const numPr = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(body)?.[1] || '';
    const numId = firstMatch(/<w:numId\s+w:val="(\d+)"/, numPr);
    const ilvl = firstMatch(/<w:ilvl\s+w:val="(\d+)"/, numPr);
    styles.set(styleId, {
      level,
      numId,
      ilvl: ilvl != null ? parseInt(ilvl, 10) : level - 1,
    });
  }

  // numId -> abstractNumId
  const numToAbstract = new Map<string, string>();
  const numRe = /<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  let nm: RegExpExecArray | null;
  while ((nm = numRe.exec(numberingXml))) {
    const abs = firstMatch(/<w:abstractNumId\s+w:val="(\d+)"/, nm[2] ?? '');
    if (abs && nm[1]) numToAbstract.set(nm[1], abs);
  }

  // abstractNumId -> ilvl -> LevelDef
  const abstractDefs = new Map<string, Map<number, LevelDef>>();
  const absRe = /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  let am: RegExpExecArray | null;
  while ((am = absRe.exec(numberingXml))) {
    const levels = new Map<number, LevelDef>();
    const lvlRe = /<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
    let lm: RegExpExecArray | null;
    const absBody = am[2] ?? '';
    while ((lm = lvlRe.exec(absBody))) {
      const ilvl = parseInt(lm[1] ?? '0', 10);
      const lb = lm[2] ?? '';
      levels.set(ilvl, {
        numFmt: firstMatch(/<w:numFmt\s+w:val="([^"]+)"/, lb) || 'decimal',
        lvlText: firstMatch(/<w:lvlText\s+w:val="([^"]*)"/, lb) || '',
        start: parseInt(firstMatch(/<w:start\s+w:val="(\d+)"/, lb) || '1', 10),
      });
    }
    if (am[1]) abstractDefs.set(am[1], levels);
  }

  // Walk paragraphs in document order, counters keyed per numId instance
  const counters = new Map<string, (number | undefined)[]>();
  const result: HeadingNumber[] = [];
  const paraRe = /<w:p\b[^>]*?>([\s\S]*?)<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = paraRe.exec(documentXml))) {
    const body = pm[1] ?? '';
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(body)?.[1] || '';
    const styleId = firstMatch(/<w:pStyle\s+w:val="([^"]+)"/, pPr);
    if (!styleId) continue;
    const style = styles.get(styleId);
    if (!style) continue; // not a heading style

    // Heading text (concatenate runs)
    const texts: string[] = [];
    const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(body))) texts.push(tm[1] ?? '');
    const text = decodeHtmlEntities(texts.join('')).replace(/\s+/g, ' ').trim();

    // Effective numbering: paragraph-level numPr override wins (incl. numId="0")
    const paraNumPr = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(pPr)?.[1];
    let numId = style.numId;
    let ilvl = style.ilvl;
    if (paraNumPr) {
      const pNum = firstMatch(/<w:numId\s+w:val="(\d+)"/, paraNumPr);
      const pIlvl = firstMatch(/<w:ilvl\s+w:val="(\d+)"/, paraNumPr);
      if (pNum != null) numId = pNum;
      if (pIlvl != null) ilvl = parseInt(pIlvl, 10);
    }

    // Unnumbered (no numId, or explicit numId="0" suppression)
    if (!numId || numId === '0') {
      result.push({ level: style.level, label: null, text });
      continue;
    }

    const absId = numToAbstract.get(numId);
    const levels = absId ? abstractDefs.get(absId) : undefined;
    const def = levels?.get(ilvl);
    if (!def || !levels) {
      result.push({ level: style.level, label: null, text });
      continue;
    }

    // Advance the counter for this numId instance
    const arr = counters.get(numId) || [];
    arr[ilvl] = arr[ilvl] == null ? def.start : (arr[ilvl] as number) + 1;
    for (let k = ilvl + 1; k < arr.length; k++) arr[k] = undefined; // restart deeper levels
    counters.set(numId, arr);

    // Render the level template (%1, %2, ...) using each level's own format
    const label = def.lvlText.replace(/%(\d)/g, (_full, d: string) => {
      const idx = parseInt(d, 10) - 1;
      const val = arr[idx];
      if (val == null || Number.isNaN(val)) return '';
      const lvlFmt = levels.get(idx)?.numFmt || 'decimal';
      return formatCounter(val, lvlFmt);
    }).trim();

    result.push({ level: style.level, label: label || null, text });
  }

  return result;
}

/** Normalise heading text for order-matching between XML and markdown. */
function norm(s: string): string {
  return s
    .replace(/[*_`]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/\s+/g, ' ')
    .replace(/[.:;,]+$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Prepend computed heading numbers to the markdown headings, matching by
 * document order + text. Never produces a wrong number: a heading that can't
 * be confidently matched is left untouched.
 */
export function applyHeadingNumbers(markdown: string, entries: HeadingNumber[]): string {
  if (!entries.length) return markdown;
  const numbered = entries.filter((e) => e.label); // only those that actually carry a number
  if (!numbered.length) return markdown;

  const lines = markdown.split('\n');
  let ptr = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^```/.test(line.trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!h || !h[2]) continue;
    const text = h[2];
    const key = norm(text);
    // Find the next numbered entry (from ptr) whose text matches.
    let found = -1;
    for (let j = ptr; j < numbered.length; j++) {
      if (norm(numbered[j]!.text) === key) { found = j; break; }
    }
    if (found === -1) continue; // mammoth heading not in numbered set - leave as is
    const label = numbered[found]!.label as string;
    // Don't double-number if it somehow already starts with the label.
    if (!new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
      lines[i] = `${h[1]} ${label} ${text}`;
    }
    ptr = found + 1;
  }
  return lines.join('\n');
}
