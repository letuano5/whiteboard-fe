import type { Element } from '@vdt/shared';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

export function createBenchmarkElement(index: number, prefix = 'bench'): Element {
  const column = index % 100;
  const row = Math.floor(index / 100);
  const type = index % 5 === 0 ? 'text' : index % 3 === 0 ? 'ellipse' : 'rectangle';
  const x = column * 144;
  const y = row * 96;
  const base = {
    id: `${prefix}-el-${index}`,
    type,
    x,
    y,
    width: type === 'text' ? 120 : 96,
    height: type === 'text' ? 32 : 56,
    angle: 0,
    zIndex: index,
    version: 1,
    versionNonce: 1000 + index,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'benchmark',
  } satisfies Omit<Element, 'props'>;

  return {
    ...base,
    props: {
      strokeColor: COLORS[index % COLORS.length],
      fillColor: index % 4 === 0 ? '#f8fafc' : 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
      text: type === 'text' ? `Bench ${index}` : undefined,
      fontSize: type === 'text' ? 16 : undefined,
      fontFamily: type === 'text' ? 'Inter, sans-serif' : undefined,
      textAlign: type === 'text' ? 'left' : undefined,
    },
  };
}

export function createBenchmarkElements(count: number, prefix = 'bench'): Element[] {
  return Array.from({ length: count }, (_, index) => createBenchmarkElement(index, prefix));
}
