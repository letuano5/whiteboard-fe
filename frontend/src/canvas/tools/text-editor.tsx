import { useEffect, useRef } from 'react';
import type { Camera, Element } from '../../types/shared';
import type { Point } from '../../types/geometry';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { patchElement } from '../../store/mutation-pipeline';
import { hitTestElementAtWorldPoint } from '../shapes/hit-test';
import { resolveGroupBinding } from './select/group';
import { computeBoundTextLayout, TEXT_PADDING } from '../text/text-wrap';

export function onCanvasDoubleClick(worldPt: Point): void {
  const elements = useElementsStore.getState().elements;
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => b.zIndex - a.zIndex);
  const { setEditingId, setSelectedIds } = useInteractionStore.getState();

  for (const el of visible) {
    if (el.type !== 'text') continue;
    if (hitTestElementAtWorldPoint(el, worldPt)) {
      setEditingId(el.id);
      setSelectedIds([el.id]);
      return;
    }
  }
}

function resolveBoundContainer(text: Element, elements: Element[]): Element | undefined {
  const binding = text.groupId ? resolveGroupBinding(text.groupId, elements) : null;
  if (binding?.textId !== text.id) return undefined;
  return elements.find((el) => el.id === binding.containerId && !el.isDeleted);
}

interface TextEditorProps {
  element: Element;
  camera: Camera;
}

export default function TextEditor({ element, camera }: TextEditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const committed = useRef(false);
  const { setEditingId } = useInteractionStore.getState();

  const { zoom } = camera;
  const screenLeft = (element.x - camera.x) * zoom;
  const screenTop = (element.y - camera.y) * zoom;
  const screenW = element.width * zoom;
  const screenH = element.height * zoom;
  const fontSize = (element.props.fontSize ?? 16) * zoom;
  const angleDeg = (element.angle * 180) / Math.PI;

  const elements = useElementsStore.getState().elements;
  const container = resolveBoundContainer(element, elements);
  const boundLayout = container
    ? computeBoundTextLayout(container, { props: element.props })
    : null;

  function commit() {
    if (committed.current || !divRef.current) return;
    committed.current = true;
    const div = divRef.current;
    const text = div.innerText;
    const props = { ...element.props, text };

    const freshElements = useElementsStore.getState().elements;
    const container = resolveBoundContainer(element, freshElements);

    if (container) {
      // Bound label: re-center and re-wrap to the container instead of free-growing to content.
      const layout = computeBoundTextLayout(container, { props });
      const requiredHeight = layout.height + TEXT_PADDING * 2;
      let finalLayout = layout;
      if (requiredHeight > container.height) {
        // Text wraps taller than the container — grow the container's height (keeping its
        // center fixed) instead of letting the label overflow past its bounds.
        const newHeight = requiredHeight;
        const newY = container.y - (newHeight - container.height) / 2;
        patchElement(container.id, { y: newY, height: newHeight });
        const grownContainer = { ...container, y: newY, height: newHeight };
        finalLayout = computeBoundTextLayout(grownContainer, { props });
      }
      patchElement(element.id, {
        props,
        x: finalLayout.x,
        y: finalLayout.y,
        width: finalLayout.width,
        height: finalLayout.height,
      });
    } else {
      const w = div.scrollWidth / zoom;
      const h = div.scrollHeight / zoom;
      patchElement(element.id, { props, width: Math.max(w, 1), height: Math.max(h, 1) });
    }
    setEditingId(null);
  }

  function handleBlur() {
    commit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      commit();
    }
  }

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    div.innerText = element.props.text ?? '';
    div.focus();
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left: `${screenLeft}px`,
        top: `${screenTop}px`,
        width: boundLayout ? `${boundLayout.width * zoom}px` : undefined,
        fontSize: `${fontSize}px`,
        fontFamily: element.props.fontFamily ?? 'sans-serif',
        color: element.props.strokeColor,
        opacity: element.props.opacity,
        textAlign: element.props.textAlign ?? 'left',
        transformOrigin: `${screenW / 2}px ${screenH / 2}px`,
        transform: `rotate(${angleDeg}deg)`,
        whiteSpace: boundLayout ? 'pre-wrap' : 'pre',
        outline: 'none',
        background: 'transparent',
        border: 'none',
        padding: '0',
        margin: '0',
        lineHeight: '1.2',
        cursor: 'text',
        userSelect: 'text',
      }}
    />
  );
}
