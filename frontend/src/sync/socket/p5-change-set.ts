import type {
  CommittedChangeSet,
  Element,
  PointTuple,
  SlotPatch,
  SyncSlot,
  SlotValue,
} from '../../types/shared';

export function applyChangeSetToElements(
  elements: readonly Element[],
  changeSet: CommittedChangeSet,
): Element[] {
  const deleteIds = new Set(changeSet.deletes);
  const putById = new Map(changeSet.puts.map((element) => [element.id, element]));
  const patchById = new Map<string, SlotPatch[]>();
  for (const patch of changeSet.slotPatches) {
    patchById.set(patch.elementId, [...(patchById.get(patch.elementId) ?? []), patch]);
  }

  const nextElements: Element[] = [];
  const seen = new Set<string>();

  for (const element of elements) {
    if (deleteIds.has(element.id)) continue;
    const put = putById.get(element.id);
    if (put) {
      nextElements.push(put);
      seen.add(element.id);
      continue;
    }
    const patches = patchById.get(element.id);
    nextElements.push(patches ? patches.reduce(applySlotPatch, element) : element);
    seen.add(element.id);
  }

  for (const put of changeSet.puts) {
    if (!seen.has(put.id) && !deleteIds.has(put.id)) {
      nextElements.push(put);
    }
  }

  return nextElements;
}

export function applySlotPatch(element: Element, patch: SlotPatch): Element {
  const next: Element = { ...element, props: { ...element.props } };

  switch (patch.slot) {
    case 'transform.position': {
      const changes = patch.changes as SlotValue<'transform.position'>;
      return { ...next, x: changes.x, y: changes.y };
    }
    case 'transform.size': {
      const changes = patch.changes as SlotValue<'transform.size'>;
      return { ...next, width: changes.width, height: changes.height };
    }
    case 'transform.rotation': {
      const changes = patch.changes as SlotValue<'transform.rotation'>;
      return { ...next, angle: changes.angle };
    }
    case 'style.strokeColor': {
      const changes = patch.changes as SlotValue<'style.strokeColor'>;
      next.props.strokeColor = changes.strokeColor;
      return next;
    }
    case 'style.fillColor': {
      const changes = patch.changes as SlotValue<'style.fillColor'>;
      next.props.fillColor = changes.fillColor;
      return next;
    }
    case 'style.strokeWidth': {
      const changes = patch.changes as SlotValue<'style.strokeWidth'>;
      next.props.strokeWidth = changes.strokeWidth;
      return next;
    }
    case 'style.strokeStyle': {
      const changes = patch.changes as SlotValue<'style.strokeStyle'>;
      next.props.strokeStyle = changes.strokeStyle;
      return next;
    }
    case 'style.opacity': {
      const changes = patch.changes as SlotValue<'style.opacity'>;
      next.props.opacity = changes.opacity;
      return next;
    }
    case 'style.roughness': {
      const changes = patch.changes as SlotValue<'style.roughness'>;
      setOptionalProp(next.props, 'roughness', changes.roughness);
      return next;
    }
    case 'text.text': {
      const changes = patch.changes as SlotValue<'text.text'>;
      setOptionalProp(next.props, 'text', changes.text);
      return next;
    }
    case 'text.fontSize': {
      const changes = patch.changes as SlotValue<'text.fontSize'>;
      setOptionalProp(next.props, 'fontSize', changes.fontSize);
      return next;
    }
    case 'text.fontFamily': {
      const changes = patch.changes as SlotValue<'text.fontFamily'>;
      setOptionalProp(next.props, 'fontFamily', changes.fontFamily);
      return next;
    }
    case 'text.textAlign': {
      const changes = patch.changes as SlotValue<'text.textAlign'>;
      setOptionalProp(next.props, 'textAlign', changes.textAlign);
      return next;
    }
    case 'geometry.points': {
      const changes = patch.changes as SlotValue<'geometry.points'>;
      return applyGeometryPoints(next, changes.points);
    }
    case 'geometry.startPoint': {
      const changes = patch.changes as SlotValue<'geometry.startPoint'>;
      return applyEndpointPoint(next, 0, changes.startPoint);
    }
    case 'geometry.endPoint': {
      const changes = patch.changes as SlotValue<'geometry.endPoint'>;
      return applyEndpointPoint(next, -1, changes.endPoint);
    }
    case 'binding.start': {
      const changes = patch.changes as SlotValue<'binding.start'>;
      next.props.startBinding = changes.binding;
      return next;
    }
    case 'binding.end': {
      const changes = patch.changes as SlotValue<'binding.end'>;
      next.props.endBinding = changes.binding;
      return next;
    }
    case 'asset.src': {
      const changes = patch.changes as SlotValue<'asset.src'>;
      setOptionalProp(next.props, 'src', changes.src);
      return next;
    }
    case 'embed.url': {
      const changes = patch.changes as SlotValue<'embed.url'>;
      setOptionalProp(next.props, 'url', changes.url);
      return next;
    }
    case 'grouping.groupId': {
      const changes = patch.changes as SlotValue<'grouping.groupId'>;
      return { ...next, groupId: changes.groupId };
    }
    case 'grouping.frameId': {
      const changes = patch.changes as SlotValue<'grouping.frameId'>;
      return { ...next, frameId: changes.frameId };
    }
    case 'state.locked': {
      const changes = patch.changes as SlotValue<'state.locked'>;
      return { ...next, locked: changes.locked };
    }
    case 'geometry.route':
    case 'order':
      return next;
  }
}

export function slotValueFromElement(slot: SyncSlot, element: Element): SlotValue {
  switch (slot) {
    case 'transform.position':
      return { x: element.x, y: element.y };
    case 'transform.size':
      return { width: element.width, height: element.height };
    case 'transform.rotation':
      return { angle: element.angle };
    case 'style.strokeColor':
      return { strokeColor: element.props.strokeColor };
    case 'style.fillColor':
      return { fillColor: element.props.fillColor };
    case 'style.strokeWidth':
      return { strokeWidth: element.props.strokeWidth };
    case 'style.strokeStyle':
      return { strokeStyle: element.props.strokeStyle };
    case 'style.opacity':
      return { opacity: element.props.opacity };
    case 'style.roughness':
      return { roughness: element.props.roughness ?? null };
    case 'text.text':
      return { text: element.props.text ?? null };
    case 'text.fontSize':
      return { fontSize: element.props.fontSize ?? null };
    case 'text.fontFamily':
      return { fontFamily: element.props.fontFamily ?? null };
    case 'text.textAlign':
      return { textAlign: element.props.textAlign ?? null };
    case 'geometry.points':
      return { points: element.props.points ?? [] };
    case 'geometry.route':
      return { route: element.props.points ?? null };
    case 'geometry.startPoint':
      return { startPoint: element.props.points?.[0] ?? null };
    case 'geometry.endPoint':
      return { endPoint: element.props.points?.[element.props.points.length - 1] ?? null };
    case 'binding.start':
      return {
        binding:
          typeof element.props.startBinding === 'string'
            ? null
            : (element.props.startBinding ?? null),
      };
    case 'binding.end':
      return {
        binding:
          typeof element.props.endBinding === 'string' ? null : (element.props.endBinding ?? null),
      };
    case 'order':
      return { zIndex: element.zIndex };
    case 'asset.src':
      return { src: element.props.src ?? null };
    case 'embed.url':
      return { url: element.props.url ?? null };
    case 'grouping.groupId':
      return { groupId: element.groupId };
    case 'grouping.frameId':
      return { frameId: element.frameId };
    case 'state.locked':
      return { locked: element.locked };
  }
}

function setOptionalProp<K extends keyof Element['props']>(
  props: Element['props'],
  key: K,
  value: Element['props'][K] | null,
): void {
  if (value === null) {
    delete props[key];
    return;
  }
  props[key] = value;
}

function applyEndpointPoint(element: Element, index: 0 | -1, point: PointTuple | null): Element {
  if (point === null) return element;
  const points = [...(element.props.points ?? [])];
  if (index === 0) {
    points[0] = point;
  } else {
    points[Math.max(points.length - 1, 0)] = point;
  }
  return applyGeometryPoints(element, points);
}

function applyGeometryPoints(element: Element, points: PointTuple[]): Element {
  const next = { ...element, props: { ...element.props, points: points.map(clonePoint) } };
  return { ...next, ...normalizeLinearBounds(points) };
}

function clonePoint(point: PointTuple): PointTuple {
  return [point[0], point[1]];
}

function normalizeLinearBounds(
  points: readonly PointTuple[],
): Pick<Element, 'x' | 'y' | 'width' | 'height'> {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
