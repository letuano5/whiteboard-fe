import type { Element, ElementProps } from '../../types/shared';

export type ElementMutationPatch = Partial<
  Omit<Element, 'id' | 'version' | 'versionNonce' | 'updatedAt'>
>;

export interface ElementUpdatePatch {
  id: string;
  patch: ElementMutationPatch;
}

const DEFAULT_FONT_SIZE = 16;
const TEXT_LINE_HEIGHT = 1.2;

export function buildPropsPatch(
  element: Element,
  partialProps: Partial<ElementProps>,
): ElementMutationPatch {
  return {
    props: { ...element.props, ...partialProps },
  };
}

export function buildMultiPropsPatches(
  elements: Element[],
  partialProps: Partial<ElementProps>,
): ElementUpdatePatch[] {
  return elements.map((element) => ({
    id: element.id,
    patch: buildPropsPatch(element, partialProps),
  }));
}

export function buildAnglePatchFromDegrees(degrees: number): ElementMutationPatch {
  return {
    angle: (degrees * Math.PI) / 180,
  };
}

export function buildTextFontSizePatch(
  element: Element,
  nextFontSizeInput: number,
): ElementMutationPatch {
  const nextFontSize = Math.max(1, nextFontSizeInput);
  const previousFontSize = element.props.fontSize ?? DEFAULT_FONT_SIZE;
  const scale = previousFontSize > 0 ? nextFontSize / previousFontSize : 1;

  return {
    props: { ...element.props, fontSize: nextFontSize },
    width: Math.max(1, element.width * scale),
    height: Math.max(1, element.height * scale),
  };
}

export function buildTextFontFamilyPatch(
  element: Element,
  nextFontFamily: string,
): ElementMutationPatch {
  const props = { ...element.props, fontFamily: nextFontFamily };
  const measured = measureTextBounds(props);

  return {
    props,
    width: Math.max(1, measured.width),
    height: Math.max(1, measured.height),
  };
}

function measureTextBounds(props: ElementProps): { width: number; height: number } {
  const fontSize = Math.max(1, props.fontSize ?? DEFAULT_FONT_SIZE);
  const lines = (props.text ?? '').split('\n');
  const strokePadding = Math.max(0, props.strokeWidth ?? 0) * 2;
  const widths = lines.map((line) => measureTextLine(line, fontSize, props.fontFamily));

  return {
    width: Math.max(1, ...widths) + strokePadding,
    height: Math.max(1, lines.length * fontSize * TEXT_LINE_HEIGHT) + strokePadding,
  };
}

function measureTextLine(line: string, fontSize: number, fontFamily?: string): number {
  const canvasWidth = measureTextLineWithCanvas(line, fontSize, fontFamily);
  if (canvasWidth !== null) return canvasWidth;

  if (line.length === 0) return 0;
  return line.length * fontSize * getFallbackFontWidthFactor(fontFamily);
}

function measureTextLineWithCanvas(
  line: string,
  fontSize: number,
  fontFamily?: string,
): number | null {
  if (typeof document === 'undefined') return null;
  const userAgent = document.defaultView?.navigator.userAgent.toLowerCase() ?? '';
  if (userAgent.includes('jsdom')) return null;

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.font = `${fontSize}px ${fontFamily ?? 'sans-serif'}`;
    return context.measureText(line).width;
  } catch {
    return null;
  }
}

function getFallbackFontWidthFactor(fontFamily?: string): number {
  const normalized = (fontFamily ?? 'sans-serif').toLowerCase();
  if (normalized.includes('monospace')) return 0.62;
  if (normalized.includes('serif')) return 0.58;
  return 0.55;
}
