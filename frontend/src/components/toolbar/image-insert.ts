import { useCameraStore } from '../../store/camera.store';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { createElement, patchElement, type ElementDraft } from '../../store/mutation-pipeline';

const DEFAULT_IMAGE_WIDTH = 640;
const DEFAULT_IMAGE_HEIGHT = 360;

const EMPTY_IMAGE_PROPS: ElementDraft['props'] = {
  strokeColor: 'transparent',
  fillColor: 'transparent',
  strokeWidth: 0,
  strokeStyle: 'solid',
  opacity: 1,
};

function getViewportCenterBounds(): Pick<ElementDraft, 'x' | 'y' | 'width' | 'height'> {
  const { camera } = useCameraStore.getState();
  const viewportWidth =
    typeof window === 'undefined' || !Number.isFinite(window.innerWidth) ? 1024 : window.innerWidth;
  const viewportHeight =
    typeof window === 'undefined' || !Number.isFinite(window.innerHeight)
      ? 768
      : window.innerHeight;

  return {
    x: camera.x + viewportWidth / (2 * camera.zoom) - DEFAULT_IMAGE_WIDTH / 2,
    y: camera.y + viewportHeight / (2 * camera.zoom) - DEFAULT_IMAGE_HEIGHT / 2,
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT,
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Image file could not be read as a data URL.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Image file could not be read.'));
    reader.readAsDataURL(file);
  });
}

export function insertImageFromSource(src: string): void {
  const trimmedSrc = src.trim();
  if (!trimmedSrc) return;

  const visibleElements = useElementsStore
    .getState()
    .elements.filter((element) => !element.isDeleted);
  const image = createElement({
    type: 'image',
    ...getViewportCenterBounds(),
    props: {
      ...EMPTY_IMAGE_PROPS,
      src: trimmedSrc,
    },
    angle: 0,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: '',
  });

  if (visibleElements.length > 0) {
    const minZIndex = Math.min(...visibleElements.map((element) => element.zIndex));
    patchElement(image.id, { zIndex: minZIndex - 1 });
  }

  const { setSelectedIds, setTool } = useInteractionStore.getState();
  setSelectedIds([image.id]);
  setTool('select');
}
