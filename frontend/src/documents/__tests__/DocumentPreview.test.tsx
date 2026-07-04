import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentPreview } from '../DocumentPreview';
import type { Element } from '../../types/shared';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'test-id',
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
    versionNonce: 12345,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

describe('DocumentPreview', () => {
  it('renders freehand strokes as a <path>, not a placeholder rect', () => {
    const element = makeElement({
      type: 'freehand',
      props: {
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        points: [
          [0, 0],
          [10, 10],
          [20, 0],
        ],
      },
    });

    const { container } = render(<DocumentPreview elements={[element]} title="Board" />);

    expect(container.querySelector('path[stroke]')).not.toBeNull();
    expect(container.querySelector('rect[rx="4"]')).toBeNull();
  });

  it('renders highlighter strokes as a <path>, not a placeholder rect', () => {
    const element = makeElement({
      type: 'highlighter',
      props: {
        strokeColor: '#ff0',
        fillColor: 'transparent',
        strokeWidth: 8,
        strokeStyle: 'solid',
        opacity: 0.4,
        points: [
          [0, 0],
          [30, 0],
        ],
      },
    });

    const { container } = render(<DocumentPreview elements={[element]} title="Board" />);

    expect(container.querySelector('path[stroke]')).not.toBeNull();
    expect(container.querySelector('rect[rx="4"]')).toBeNull();
  });

  it('renders triangle and polygon as <polygon>, not a placeholder rect', () => {
    const triangle = makeElement({ id: 'tri', type: 'triangle' });
    const polygon = makeElement({ id: 'poly', type: 'polygon' });

    const { container } = render(
      <DocumentPreview elements={[triangle, polygon]} title="Board" />,
    );

    expect(container.querySelectorAll('polygon').length).toBe(2);
    expect(container.querySelector('rect[rx="4"]')).toBeNull();
  });

  it('renders image elements as SVG images, not placeholder rects', () => {
    const element = makeElement({
      type: 'image',
      width: 320,
      height: 180,
      props: {
        strokeColor: 'transparent',
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: 0.8,
        src: 'data:image/png;base64,AAAA',
      },
    });

    const { container } = render(<DocumentPreview elements={[element]} title="Board" />);

    const image = container.querySelector('image');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('href', 'data:image/png;base64,AAAA');
    expect(image).toHaveAttribute('width', '320');
    expect(image).toHaveAttribute('height', '180');
    expect(container.querySelector('rect[rx="4"]')).toBeNull();
  });

  it('excludes soft-deleted elements from the preview', () => {
    const active = makeElement({ id: 'active' });
    const deleted = makeElement({ id: 'deleted', isDeleted: true });

    const { container } = render(<DocumentPreview elements={[active, deleted]} title="Board" />);

    expect(container.querySelectorAll('rect[rx="4"]').length).toBe(1);
  });
});
