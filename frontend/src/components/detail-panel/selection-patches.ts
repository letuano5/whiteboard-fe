import type { Element, ElementProps } from '../../types/shared';

export type ElementMutationPatch = Partial<
  Omit<Element, 'id' | 'version' | 'versionNonce' | 'updatedAt'>
>;

export interface ElementUpdatePatch {
  id: string;
  patch: ElementMutationPatch;
}

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
  const previousFontSize = element.props.fontSize ?? 16;
  const scale = previousFontSize > 0 ? nextFontSize / previousFontSize : 1;

  return {
    props: { ...element.props, fontSize: nextFontSize },
    width: Math.max(1, element.width * scale),
    height: Math.max(1, element.height * scale),
  };
}
