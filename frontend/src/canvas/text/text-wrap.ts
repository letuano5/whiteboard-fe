import type { Element } from '../../types/shared';
import { resolveGroupBinding } from '../tools/select/group';

export type MeasureFn = (text: string, font: string) => number;

const FALLBACK_FONT_SIZE = 16;
export const TEXT_PADDING = 8;
const MIN_WRAP_WIDTH = 24;

let measureContext: CanvasRenderingContext2D | null | undefined;

function getFontSize(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : FALLBACK_FONT_SIZE;
}

export function buildFontString(element: Pick<Element, 'props'>): string {
  return `${element.props.fontSize ?? FALLBACK_FONT_SIZE}px ${
    element.props.fontFamily ?? 'sans-serif'
  }`;
}

export function measureTextWidth(text: string, font: string, measure?: MeasureFn): number {
  if (measure) return measure(text, font);
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')) {
    return text.length * getFontSize(font) * 0.6;
  }
  if (measureContext === undefined) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    measureContext = canvas?.getContext('2d') ?? null;
  }
  if (measureContext) {
    measureContext.font = font;
    return measureContext.measureText(text).width;
  }
  return text.length * getFontSize(font) * 0.6;
}

function splitLongWord(
  word: string,
  maxWidth: number,
  font: string,
  measure?: MeasureFn,
): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const char of word) {
    const candidate = current + char;
    if (current.length > 0 && measureTextWidth(candidate, font, measure) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function wrapParagraph(paragraph: string, maxWidth: number, font: string, measure?: MeasureFn) {
  if (paragraph.length === 0) return [''];
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (measureTextWidth(word, font, measure) > maxWidth) {
      // Word alone overflows the wrap width — force-break it like CSS overflow-wrap: break-word.
      if (current.length > 0) {
        lines.push(current);
        current = '';
      }
      const chunks = splitLongWord(word, maxWidth, font, measure);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] ?? '';
      continue;
    }
    if (current.length === 0) {
      current = word;
      continue;
    }
    const candidate = `${current} ${word}`;
    if (measureTextWidth(candidate, font, measure) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

export function wrapText(
  text: string,
  maxWidth: number,
  font: string,
  measure?: MeasureFn,
): string[] {
  const width = Math.max(1, maxWidth);
  const paragraphs = text.length === 0 ? [''] : text.split('\n');
  return paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, width, font, measure));
}

export function computeBoundTextLayout(
  container: Element,
  textEl: Pick<Element, 'props'>,
  measure?: MeasureFn,
) {
  const fontSize = textEl.props.fontSize ?? FALLBACK_FONT_SIZE;
  const lineHeight = fontSize * 1.2;
  const width = Math.max(MIN_WRAP_WIDTH, container.width - TEXT_PADDING * 2);
  const font = buildFontString(textEl);
  const lines = wrapText(textEl.props.text ?? '', width, font, measure);
  const height = lines.length * lineHeight;

  return {
    x: container.x + (container.width - width) / 2,
    y: container.y + (container.height - height) / 2,
    width,
    height,
    lines,
    lineHeight,
  };
}

export function getBoundTextLines(element: Element, elements: Element[], measure?: MeasureFn) {
  if (element.type !== 'text' || !element.groupId) return null;
  const binding = resolveGroupBinding(element.groupId, elements);
  if (binding?.textId !== element.id) return null;
  const container = elements.find((el) => el.id === binding.containerId && !el.isDeleted);
  if (!container) return null;
  const layout = computeBoundTextLayout(container, element, measure);
  return {
    lines: layout.lines,
    lineHeight: layout.lineHeight,
    textX: layout.x + layout.width / 2,
    firstLineY: layout.y + (element.props.fontSize ?? FALLBACK_FONT_SIZE),
  };
}
