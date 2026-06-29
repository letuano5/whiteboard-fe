import type { ElementProps } from '../../types/shared';

export function strokeDashArray(style: ElementProps['strokeStyle']): string | undefined {
  if (style === 'dashed') return '8 4';
  if (style === 'dotted') return '2 4';
  return undefined;
}
