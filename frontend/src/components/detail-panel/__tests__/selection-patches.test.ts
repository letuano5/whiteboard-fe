import { describe, expect, it } from 'vitest';
import type { Element } from '../../../types/shared';
import {
  buildAnglePatchFromDegrees,
  buildMultiPropsPatches,
  buildPropsPatch,
  buildTextFontFamilyPatch,
  buildTextFontSizePatch,
} from '../selection-patches';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'test-el',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 123,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

describe('detail panel selection patch helpers', () => {
  it('builds a single-element props patch without dropping existing props', () => {
    const element = makeElement();

    expect(buildPropsPatch(element, { strokeColor: '#ff0000' })).toEqual({
      props: { ...element.props, strokeColor: '#ff0000' },
    });
  });

  it('builds multi-select props patches against each element props object', () => {
    const first = makeElement({ id: 'first', props: { ...makeElement().props, opacity: 0.25 } });
    const second = makeElement({
      id: 'second',
      props: { ...makeElement().props, strokeWidth: 8 },
    });

    expect(buildMultiPropsPatches([first, second], { fillColor: '#00ff00' })).toEqual([
      { id: 'first', patch: { props: { ...first.props, fillColor: '#00ff00' } } },
      { id: 'second', patch: { props: { ...second.props, fillColor: '#00ff00' } } },
    ]);
  });

  it('converts angle degrees to radians', () => {
    expect(buildAnglePatchFromDegrees(45)).toEqual({ angle: Math.PI / 4 });
  });

  it('scales text bounds proportionally when font size changes', () => {
    const element = makeElement({
      type: 'text',
      width: 200,
      height: 40,
      props: { ...makeElement().props, fontSize: 16, text: 'Hello' },
    });

    expect(buildTextFontSizePatch(element, 32)).toEqual({
      props: { ...element.props, fontSize: 32 },
      width: 400,
      height: 80,
    });
  });

  it('clamps text font size to at least one', () => {
    const element = makeElement({
      type: 'text',
      width: 100,
      height: 20,
      props: { ...makeElement().props, fontSize: 10, text: 'Hello' },
    });

    expect(buildTextFontSizePatch(element, 0)).toEqual({
      props: { ...element.props, fontSize: 1 },
      width: 10,
      height: 2,
    });
  });

  it('expands text bounds when changing to a wider font family', () => {
    const element = makeElement({
      type: 'text',
      width: 1,
      height: 1,
      props: {
        ...makeElement().props,
        fontSize: 16,
        fontFamily: 'sans-serif',
        text: 'WWWWWW',
      },
    });

    const patch = buildTextFontFamilyPatch(element, 'monospace');

    expect(patch.props).toEqual({ ...element.props, fontFamily: 'monospace' });
    expect(patch.width).toBeGreaterThan(element.width);
    expect(patch.height).toBeGreaterThan(element.height);
  });

  it('shrinks text bounds when changing to a narrower font family', () => {
    const element = makeElement({
      type: 'text',
      width: 200,
      height: 80,
      props: {
        ...makeElement().props,
        fontSize: 16,
        fontFamily: 'monospace',
        text: 'WWW',
      },
    });

    const patch = buildTextFontFamilyPatch(element, 'serif');

    expect(patch.props).toEqual({ ...element.props, fontFamily: 'serif' });
    expect(patch.width).toBeCloseTo(31.84);
    expect(patch.height).toBeCloseTo(23.2);
    expect(patch.width).toBeLessThan(element.width);
    expect(patch.height).toBeLessThan(element.height);
  });
});
