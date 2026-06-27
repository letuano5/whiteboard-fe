import type { Element } from '../types/shared';
import { generateId } from '../utils/id';
import { useElementsStore } from './elements.store';

export interface MutationEvent {
  type: 'create' | 'patch' | 'delete' | 'update';
  elements: Element[];
  before: Element[];
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

export function dispatchMutationEvent(event: MutationEvent): void {
  fireHooks(event);
}

function nextNonce(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

export type ElementDraft = Omit<
  Element,
  'id' | 'version' | 'versionNonce' | 'updatedAt' | 'zIndex' | 'isDeleted'
>;

export function createElements(drafts: ElementDraft[]): Element[] {
  if (drafts.length === 0) return [];
  const { elements } = useElementsStore.getState();
  const baseZIndex = elements.length === 0 ? 0 : Math.max(...elements.map((e) => e.zIndex));
  const now = Date.now();

  const created: Element[] = drafts.map((draft, i) => ({
    ...draft,
    id: generateId(),
    zIndex: baseZIndex + 1 + i,
    version: 1,
    versionNonce: nextNonce(),
    updatedAt: now,
    isDeleted: false,
  }));

  useElementsStore.getState().addElements(created);
  fireHooks({ type: 'create', elements: created, before: [] });
  return created;
}

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
  fireHooks({ type: 'create', elements: [element], before: [] });
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
  fireHooks({ type: 'patch', elements: [updated], before: [existing] });
}

export function deleteElements(ids: string[]): void {
  const { elements } = useElementsStore.getState();
  const now = Date.now();
  const idSet = new Set(ids);

  const originals = elements.filter((e) => idSet.has(e.id) && !e.isDeleted);
  const softDeleted = originals.map((e) => ({
    ...e,
    isDeleted: true,
    version: e.version + 1,
    versionNonce: nextNonce(),
    updatedAt: now,
  }));

  if (softDeleted.length === 0) return;

  useElementsStore.getState().updateElements(softDeleted);
  fireHooks({ type: 'delete', elements: softDeleted, before: originals });
}

export function updateElements(
  patches: {
    id: string;
    patch: Partial<Omit<Element, 'id' | 'version' | 'versionNonce' | 'updatedAt'>>;
  }[],
): void {
  const { elements } = useElementsStore.getState();
  const now = Date.now();

  const beforeMap = new Map(elements.map((e) => [e.id, e]));
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

  const before = updated.map((el) => beforeMap.get(el.id)!);
  useElementsStore.getState().updateElements(updated);
  fireHooks({ type: 'update', elements: updated, before });
}

export function applySnapshot(elements: Element[]): void {
  if (elements.length === 0) return;
  const now = Date.now();
  const storeElements = useElementsStore.getState().elements;
  const bumped = elements.map((el) => {
    const current = storeElements.find((s) => s.id === el.id);
    // Increment from the current store version so it is always monotonically increasing (AC-14)
    const baseVersion = current ? current.version : el.version;
    return {
      ...el,
      version: baseVersion + 1,
      versionNonce: nextNonce(),
      updatedAt: now,
    };
  });
  // Use the Zustand store setter directly (NOT the pipeline updateElements) to avoid version-doubling
  useElementsStore.getState().updateElements(bumped);
  fireHooks({ type: 'update', elements: bumped, before: elements });
}
