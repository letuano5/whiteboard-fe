import type { Element } from '../types/shared';
import { generateId } from '../utils/id';
import { useElementsStore } from './elements.store';

export interface MutationEvent {
  type: 'create' | 'patch' | 'delete' | 'update';
  elements: Element[];
}

type MutationHook = (event: MutationEvent) => void;

const _hooks: MutationHook[] = [];

export function registerMutationHook(hook: MutationHook): () => void {
  _hooks.push(hook);
  return () => {
    const idx = _hooks.indexOf(hook);
    if (idx !== -1) _hooks.splice(idx, 1);
  };
}

function fireHooks(event: MutationEvent): void {
  _hooks.forEach((h) => h(event));
}

function nextNonce(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

export type ElementDraft = Omit<
  Element,
  'id' | 'version' | 'versionNonce' | 'updatedAt' | 'zIndex' | 'isDeleted'
>;

export function createElement(draft: ElementDraft): Element {
  const { elements } = useElementsStore.getState();
  const maxZIndex = elements.length === 0 ? 0 : Math.max(...elements.map((e) => e.zIndex));

  const element: Element = {
    ...draft,
    id: generateId(),
    zIndex: maxZIndex + 1,
    version: 1,
    versionNonce: nextNonce(),
    updatedAt: Date.now(),
    isDeleted: false,
  };

  useElementsStore.getState().addElement(element);
  fireHooks({ type: 'create', elements: [element] });
  return element;
}

export function patchElement(
  id: string,
  patch: Partial<Omit<Element, 'id' | 'version' | 'versionNonce' | 'updatedAt'>>,
): void {
  const { elements } = useElementsStore.getState();
  const existing = elements.find((e) => e.id === id);
  if (!existing || existing.isDeleted) return;

  const updated: Element = {
    ...existing,
    ...patch,
    id: existing.id,
    version: existing.version + 1,
    versionNonce: nextNonce(),
    updatedAt: Date.now(),
  };

  useElementsStore.getState().updateElement(updated);
  fireHooks({ type: 'patch', elements: [updated] });
}

export function deleteElements(ids: string[]): void {
  const { elements } = useElementsStore.getState();
  const now = Date.now();
  const idSet = new Set(ids);

  const softDeleted = elements
    .filter((e) => idSet.has(e.id) && !e.isDeleted)
    .map((e) => ({
      ...e,
      isDeleted: true,
      version: e.version + 1,
      versionNonce: nextNonce(),
      updatedAt: now,
    }));

  if (softDeleted.length === 0) return;

  useElementsStore.getState().updateElements(softDeleted);
  fireHooks({ type: 'delete', elements: softDeleted });
}

export function updateElements(
  patches: {
    id: string;
    patch: Partial<Omit<Element, 'id' | 'version' | 'versionNonce' | 'updatedAt'>>;
  }[],
): void {
  const { elements } = useElementsStore.getState();
  const now = Date.now();

  const updated = patches.reduce<Element[]>((acc, { id, patch }) => {
    const existing = elements.find((e) => e.id === id);
    if (!existing || existing.isDeleted) return acc;
    acc.push({
      ...existing,
      ...patch,
      id: existing.id,
      version: existing.version + 1,
      versionNonce: nextNonce(),
      updatedAt: now,
    });
    return acc;
  }, []);

  if (updated.length === 0) return;

  useElementsStore.getState().updateElements(updated);
  fireHooks({ type: 'update', elements: updated });
}
