import { describe, expect, it } from 'vitest';
import { computeBoundTextLayout, measureTextWidth, wrapText } from '../text-wrap';
import { makeElement } from '../../tools/select/__tests__/test-utils';

const measure = (text: string) => text.length * 10;

describe('text wrapping for bound labels', () => {
  it('@covers AC-4 measures text with an injected function and a safe default fallback', () => {
    expect(measureTextWidth('abc', '16px sans-serif', measure)).toBe(30);
    expect(measureTextWidth('abc', '16px sans-serif')).toBeGreaterThan(0);
  });

  it('@covers AC-4 greedily wraps words and preserves explicit line breaks', () => {
    expect(wrapText('Alpha Bravo Charlie', 80, '16px sans-serif', measure)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
    expect(wrapText('Alpha\nBravo', 80, '16px sans-serif', measure)).toEqual(['Alpha', 'Bravo']);
    expect(wrapText('Longword', 10, '16px sans-serif', measure)).toEqual(['Longword']);
  });

  it('@covers AC-4 centers layout inside the container with padding and line-height', () => {
    const container = makeElement({ x: 10, y: 20, width: 100, height: 60 });
    const text = makeElement({
      type: 'text',
      props: { ...makeElement().props, text: 'Alpha Bravo', fontSize: 10 },
    });

    const layout = computeBoundTextLayout(container, text, measure);
    expect(layout.width).toBe(84);
    expect(layout.lineHeight).toBe(12);
    expect(layout.x).toBe(18);
    expect(layout.y).toBe(38);
  });
});
