import type { Element } from '../../../types/shared';

export function translatePointGeometry(el: Element, dx: number, dy: number): Element['props'] {
  if (!el.props.points) return el.props;
  return {
    ...el.props,
    points: el.props.points.map(([x, y]) => [x + dx, y + dy]),
  };
}

export function resizePointGeometry(
  el: Element,
  bounds: { x: number; y: number; width: number; height: number },
  flippedX: boolean,
  flippedY: boolean,
): Element['props'] {
  const points = el.props.points;
  if (!points) return el.props;

  return {
    ...el.props,
    points: points.map(([px, py], index) => {
      const sequenceRatio = points.length <= 1 ? 0 : index / (points.length - 1);
      const xRatio =
        el.width !== 0
          ? (px - el.x) / el.width
          : el.height !== 0
            ? (py - el.y) / el.height
            : sequenceRatio;
      const yRatio =
        el.height !== 0
          ? (py - el.y) / el.height
          : el.width !== 0
            ? (px - el.x) / el.width
            : sequenceRatio;

      const transformedXRatio = flippedX ? 1 - xRatio : xRatio;
      const transformedYRatio = flippedY ? 1 - yRatio : yRatio;

      return [
        bounds.x + transformedXRatio * bounds.width,
        bounds.y + transformedYRatio * bounds.height,
      ];
    }),
  };
}
