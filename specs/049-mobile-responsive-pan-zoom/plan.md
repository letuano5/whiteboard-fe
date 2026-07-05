# Plan: Mobile responsive fixes + two-finger pan/pinch-zoom

Handoff document for a fresh agent/session. Written to be self-contained — do not assume
access to any prior conversation. Read `AGENTS.md` and `frontend/CLAUDE.md` first for repo
conventions (file size limits, naming, mutation pipeline rules, commit-per-logical-group).

## Context (already done, do not redo)

- Root cause of "can't draw at all on mobile" was missing `touch-action: none` on the drawing
  surface. Already fixed in `frontend/src/canvas/layers/svg/SvgLayer.tsx` (svg style) and
  `frontend/src/canvas/Whiteboard.tsx` (root container style). Single-finger draw/select/pan
  (via the Hand tool) now works correctly on touch because Pointer Events were already used
  throughout (`use-whiteboard-pointer-handlers.ts`) — no mouse-only handlers anywhere.
- Toolbar was rebuilt: `Toolbar.tsx` (7 `FIXED_TOOLS` + `ImageInsertControl` + `MoreToolsMenu`
  overflow for the rest), `ActionToolbar.tsx` (Undo/Redo/Duplicate/Delete via `ToolbarActions`,
  `ZoomControl`, keyboard-shortcuts-help button/modal).
- `DefaultStylePanel.tsx` + `useDefaultStyleStore` added: shows default draw style when a draw
  tool is active and nothing is selected; `DetailPanel.tsx` shows style of the current
  selection. Both render inside the shared `PanelShell.tsx`.
- Shortcuts done: Ctrl+A (`onSelectAll`), Ctrl+X (`onCutSelected`), Ctrl+C/V, Ctrl+D, arrow-key
  nudge (`onMoveSelected`), Ctrl+Z/Shift+Z, Delete — see `frontend/src/canvas/shortcuts/`.
  Shortcuts help modal exists at `frontend/src/components/toolbar/shortcuts-help/`.

None of the above needs to be touched except where a task below explicitly says so.

## Part 1 — Mobile responsive correctness fixes

None of `frontend/src/canvas/`, `frontend/src/components/toolbar/`,
`frontend/src/components/detail-panel/`, `frontend/src/components/context-menu/` use Tailwind
classes — everything is inline `style={{...}}` objects. Keep that pattern; don't introduce
Tailwind classes into these files. Where a media-query-like conditional is needed, add a small
hook (repo already has this pattern, see `frontend/src/hooks/use-dismiss-on-outside-click.ts`)
rather than reaching for a CSS framework feature.

### 1.1 Toolbar can overflow on narrow phones (required)

`frontend/src/components/toolbar/Toolbar.tsx:37-60` renders a fixed-width row: 7
`FIXED_TOOLS` buttons (36px, `ToolButton.tsx`) + `ImageInsertControl` (36px) + `MoreToolsMenu`
trigger (36px) = 9 × 36px + 8 gaps × 4px + 12px padding ≈ **368px**. This is centered via
`left:'50%', transform:'translateX(-50%)'` with no max-width or overflow handling. On a 320px
phone (iPhone SE) it overflows by ~48px with no scroping/wrapping — some buttons become
unreachable. On 360-375px devices it's within a few px of the edge, i.e. still fragile (any
future addition breaks it again).

Same risk applies to `ActionToolbar.tsx:21-37` (currently narrower, ~220px, so lower risk but
should get the same treatment for consistency/future-proofing) and the `MoreToolsMenu` popup
row (`frontend/src/components/toolbar/more-tools/MoreToolsMenu.tsx:34-53`, 7 buttons ≈ 288px).

**Fix:** make all three rows horizontally scrollable and width-clamped instead of assuming
they always fit:

```ts
style={{
  ...,
  maxWidth: 'calc(100vw - 16px)',
  overflowX: 'auto',
  scrollbarWidth: 'none',       // Firefox
  WebkitOverflowScrolling: 'touch',
}}
```

(For hiding the scrollbar on WebKit, add a one-off CSS rule in `frontend/src/index.css`
targeting a shared class, e.g. `.toolbar-scroll::-webkit-scrollbar { display: none; }`, and
apply that class name alongside the inline style — inline styles can't express
pseudo-elements.)

Apply this to: the root `div` in `Toolbar.tsx`, the root `div` in `ActionToolbar.tsx`, and the
popup `div` in `MoreToolsMenu.tsx`. Verify with browser devtools responsive mode at 320px,
360px, and 390px widths that every tool button remains reachable (by scroll if needed, never
fully clipped with no way to reach it).

### 1.2 PanelShell: add a safety max-width clamp (required, small)

`frontend/src/components/detail-panel/PanelShell.tsx:9-32` already has `maxHeight:'60vh'` +
`overflowY:'auto'` (good, no work needed there) but `minWidth:220` has no paired `maxWidth`
clamp against viewport width. On a 320px-wide screen with `right:16`, 220px + 16px is fine
today, but there's no guard if a control inside ever needs more horizontal space. Add:

```ts
maxWidth: 'min(320px, calc(100vw - 32px))',
```

Reuse the exact pattern already used correctly elsewhere in this codebase:
`frontend/src/components/ui/ManageAccessModal.tsx:79-80` and
`frontend/src/components/toolbar/ImageInsertControl.tsx:76-77` — grep those for the precise
syntax rather than reinventing it.

### 1.3 PanelShell on small screens overlaps the toolbar stack (recommended, larger)

`PanelShell` is `position:'fixed', right:16, top:88` with the two-row toolbar stack
(`ActionToolbar` at `bottom:72`, `Toolbar` at `bottom:16`) plus `MoreToolsMenu`'s popup taking
significant vertical space at the bottom of the screen. On phones in portrait (~600-800px tall
viewport, minus browser chrome), a `maxHeight:60vh` panel starting at `top:88` can end well
into the bottom toolbar area, and combined with a 44px+ keyboard (if a text field is focused)
there is a real risk of overlap.

This is a UX judgment call, not strictly "broken", so treat as recommended rather than
required: on narrow viewports (e.g. `window.innerWidth < 640` or `matchMedia('(max-width:
640px)')`), reposition `PanelShell` as a bottom sheet instead of a right-side floating panel —
full width (minus margins), anchored above the toolbar stack (`bottom: 'calc(140px + env(
safe-area-inset-bottom))'` or similar, computed from the toolbar stack's actual height), with
`maxHeight` reduced accordingly. Suggest a small hook, e.g.
`frontend/src/hooks/use-media-query.ts` (`useMediaQuery('(max-width: 640px)')` wrapping
`window.matchMedia`), consumed by `PanelShell.tsx` to switch between the two layouts. Keep the
existing desktop layout as the default/fallback branch.

If time-constrained, 1.1 + 1.2 + 1.4 + 1.5 + 1.6 below are the load-bearing fixes; 1.3 can be
deferred.

### 1.4 ContextMenu can render off-screen (required)

`frontend/src/components/context-menu/ContextMenu.tsx:111-126` positions the menu at raw
`left:x, top:y` (from `event.clientX/clientY`, set in
`frontend/src/canvas/hooks/use-whiteboard-pointer-handlers.ts` inside `handleContextMenu`,
`contextMenu` state `{x, y, id}`), with `minWidth:'160px'` and no clamping. A long-press near
the right or bottom edge of a phone screen renders the menu partially/fully off-screen with no
way to reach the cut-off items.

**Fix:** measure the actual rendered menu size after mount and clamp position. Pattern:

```tsx
const menuRef = useRef<HTMLDivElement>(null);
const [pos, setPos] = useState({ left: x, top: y, visibility: 'hidden' as const });

useLayoutEffect(() => {
  const el = menuRef.current;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(x, window.innerWidth - rect.width - margin);
  const top = Math.min(y, window.innerHeight - rect.height - margin);
  setPos({ left: Math.max(margin, left), top: Math.max(margin, top), visibility: 'visible' });
}, [x, y]);
```

Use `pos.left`/`pos.top`/`pos.visibility` in the existing style object in place of the current
`left: x, top: y`. This avoids a visible flash by rendering hidden for one frame, then
positioning — standard "measure then place" technique, already implicitly compatible with the
existing `useDismissOnOutsideClick(ref, onClose)` call which keeps using the same `ref`.

### 1.5 `100vh` should be `100dvh` (required, trivial)

`frontend/src/app/App.tsx:59`: `<div style={{ width: '100vw', height: '100vh' }}>` wrapping
`<Whiteboard>`. On mobile Safari/Chrome, `100vh` is measured including the area behind the
collapsing address bar, so the container can be taller than the actually-visible viewport,
pushing the bottom-anchored toolbar stack out of view until the user scrolls (there's nothing
to scroll here since `overflow:hidden` is set everywhere, so in practice it just looks like the
toolbar is cut off/inaccessible at the bottom).

**Fix:**

```ts
<div style={{ width: '100vw', height: '100dvh' }}>
```

`100dvh` has broad enough support (Safari 15.4+, Chrome 108+) to use directly without a
fallback chain; if you want defense-in-depth for older WebViews, set `height: '100vh'` first
and override with `100dvh` via a plain CSS rule (inline style can't express two values with a
"last one wins if supported" fallback the way CSS custom properties/`@supports` can — if you
want that, add the rule to `frontend/src/index.css` instead of inline style).

### 1.6 Safe-area-inset support for notched phones (required)

`frontend/index.html:5` viewport meta has no `viewport-fit=cover`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Without this, `env(safe-area-inset-*)` resolves to `0` everywhere, so screen-edge-anchored UI
can sit under a notch or the home-indicator bar. After adding `viewport-fit=cover`, update the
following screen-edge-anchored elements to fold the safe-area inset into their offset (not
`padding` — these are positioned via `top`/`bottom`/`left`/`right`, so the inset needs to be
added into that offset itself via `calc()`):

- `frontend/src/canvas/Whiteboard.tsx` — the dashboard `Menu` button (`className="absolute
  left-3 top-3 ..."`, Tailwind here — switch to inline style or add an arbitrary-value
  Tailwind class using `calc()`, e.g. `style={{ top: 'calc(12px + env(safe-area-inset-top))',
  left: 'calc(12px + env(safe-area-inset-left))' }}` merged with the existing className, or
  convert to plain style since this is the only Tailwind-styled element in this file).
- `frontend/src/canvas/Whiteboard.tsx` — the top-right icon cluster div (`top:'12px',
  right:'12px'`, around line 126-128 in the current file) → `top: 'calc(12px + env(
  safe-area-inset-top))'`, `right: 'calc(12px + env(safe-area-inset-right))'`.
- `frontend/src/components/toolbar/Toolbar.tsx` (`bottom:16`) → `bottom: 'calc(16px + env(
  safe-area-inset-bottom))'`.
- `frontend/src/components/toolbar/ActionToolbar.tsx` (`bottom:72`) → `bottom: 'calc(72px +
  env(safe-area-inset-bottom))'` (keep it stacked exactly 56px above the main toolbar; if you
  change the main toolbar's bottom offset formula, keep this one's base 72 in sync, or better,
  derive it as `calc(16px + <toolbar height> + env(safe-area-inset-bottom))` referencing a
  shared constant instead of two independent magic numbers — check if such a constant already
  exists before introducing one).
- `frontend/src/components/toolbar/more-tools/MoreToolsMenu.tsx` popup (`bottom:72`) — same
  note as above.

### 1.7 Touch target size (optional polish)

`ToolButton.tsx` (36px) and `ActionButton.tsx`/`ZoomControl.tsx` (30px) are below the ~44px
comfortable minimum tap target. This is real but not blocking — desktop mouse users are fine
with the current compact size, so don't just blanket-increase sizes (would look oversized on
desktop). If you want to address this, gate it behind a `(pointer: coarse)` media query (this
reliably detects touchscreens regardless of viewport width, unlike a px breakpoint) via a small
hook such as `useMediaQuery('(pointer: coarse)')` (see 1.3 for the same hook, reusable here),
and bump button dimensions conditionally. Treat as stretch scope — do Part 2 first if time is
limited.

## Part 2 — Two-finger pan + pinch-to-zoom

### Why this is needed

Today, panning only works via: (a) holding Space + drag (`use-space-pan-mode.ts`, needs a
keyboard), (b) mouse wheel/trackpad (`use-wheel-pan-zoom.ts`, needs a wheel device), (c)
selecting the **Hand** tool then single-finger dragging (works on touch now that
`touch-action:none` is set, via `isPanTrigger` in
`use-whiteboard-pointer-handlers.ts:72-74`). Zoom only works via `wheel + Ctrl/Meta` — there is
**no zoom mechanism at all on touch devices** right now, and `touch-action:none` additionally
blocks the browser's native pinch-to-zoom on the canvas (which used to zoom the whole page
crudely as an unintended side effect — that's now gone too, so touch users currently have zero
way to zoom).

Goal: standard mobile drawing-app convention — **one finger always does whatever the active
tool does** (draw/select/erase/etc, unchanged), **two fingers always pan+zoom, regardless of
the active tool**, with no mode switch required. This removes any need to flip to the Hand tool
just to pan.

### Where this goes

`frontend/src/canvas/hooks/use-whiteboard-pointer-handlers.ts` is the single owner of all
pointer dispatch, wired onto the root `<svg>` in `frontend/src/canvas/layers/svg/SvgLayer.tsx`
via `onPointerDown/onPointerMove/onPointerUp/onPointerLeave` (no `onPointerCancel` currently —
see task 2.4 below, that's a real gap to close as part of this work). All new multi-touch logic
belongs inside this hook; it is already the sole place that reads/writes pan state (`panStart`
ref, `isPanning` state) and calls `useCameraStore.getState()` for `panBy`/`zoomTo`. Do not
duplicate pan/zoom logic elsewhere.

If implementing this pushes `use-whiteboard-pointer-handlers.ts` over ~300 lines (check current
length first), split the new multi-touch tracking into its own module, e.g.
`frontend/src/canvas/hooks/use-multi-touch-gesture.ts`, following the "split by concern" rule
in `AGENTS.md`. Keep it a small, focused unit: track active pointers, expose
midpoint/distance-delta callbacks, don't fold in tool-specific knowledge.

### 2.1 Track active pointers

Add a ref at the top of `useWhiteboardPointerHandlers` (or the new extracted hook):

```ts
const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
const pinchState = useRef<{ midX: number; midY: number; dist: number } | null>(null);
```

`activePointers` maps `event.pointerId → {x: clientX, y: clientY}` for every pointer currently
down (mouse and touch both generate pointer events, but in practice only touch produces >1
simultaneous active pointer — no special-casing needed, the logic naturally does nothing extra
for a lone mouse pointer since `size` never exceeds 1 there).

Helper to compute midpoint + distance from exactly two tracked points (use the first two
`Map.values()` — insertion order is preserved by `Map`, so this is deterministic even with a
stray 3rd finger; a 3rd+ finger is simply ignored for gesture math, still tracked in the map so
cleanup on its `pointerup` doesn't corrupt the other two):

```ts
function getPinchPoints(): [{ x: number; y: number }, { x: number; y: number }] | null {
  const pts = [...activePointers.current.values()];
  if (pts.length < 2) return null;
  return [pts[0], pts[1]];
}

function midpointAndDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
    dist: Math.hypot(a.x - b.x, a.y - b.y),
  };
}
```

### 2.2 `handlePointerDown`: enter two-finger mode on the 2nd finger

At the very top of the existing `handlePointerDown` (`use-whiteboard-pointer-handlers.ts:76`),
before any existing tool dispatch:

```ts
activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

if (activePointers.current.size === 2) {
  // Second finger just landed — cancel whatever single-finger action was in
  // progress, then start the pinch/pan gesture instead of any tool logic.
  if (panStart.current) {
    panStart.current = null;
    setIsPanning(false);
  }
  if (tool === 'select') {
    onSelectPointerUp(svgWorldPoint(event, camera)); // point arg is unused internally; this
    // safely commits/clears any in-progress drag, marquee, or resize — see
    // frontend/src/canvas/tools/select/pointer-up.ts, the `_worldPt` param is
    // already prefixed unused, confirming the value passed doesn't matter.
  } else if (tool === 'freehand') {
    cancelFreehandDraw();
  } else if (tool === 'highlighter') {
    cancelHighlighterDraw();
  } else if (tool === 'eraser') {
    cancelEraserDrag();
  } else if (isShapeTool(tool)) {
    cancelShapeDraw();
  }
  // 'laser' and 'hand' need no explicit cancel: laser has no committed state to
  // roll back, and hand-tool panStart was already cleared above.

  const [p1, p2] = getPinchPoints()!;
  pinchState.current = midpointAndDistance(p1, p2);
  setIsPanning(true); // reuse existing "grabbing" cursor state
  event.currentTarget.setPointerCapture(event.pointerId);
  return;
}

if (activePointers.current.size > 2) {
  // 3rd+ finger: already in gesture mode, just track it, don't restart anything.
  return;
}
```

...then fall through to the existing logic unchanged for the `size === 1` case (first finger,
normal tool dispatch as it works today).

### 2.3 `handlePointerMove`: drive pan+zoom while 2+ pointers are active

At the top of the existing `handlePointerMove` (`use-whiteboard-pointer-handlers.ts:130`):

```ts
if (activePointers.current.has(event.pointerId)) {
  activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
}

if (pinchState.current && activePointers.current.size >= 2) {
  const [p1, p2] = getPinchPoints()!;
  const next = midpointAndDistance(p1, p2);
  const prev = pinchState.current;
  const { camera, zoomTo, panBy } = useCameraStore.getState();

  // Pan by the midpoint's screen-space delta, same sign convention as the
  // existing single-finger pan branch just below in this file.
  const dx = next.midX - prev.midX;
  const dy = next.midY - prev.midY;
  if (dx !== 0 || dy !== 0) panBy(-dx / camera.zoom, -dy / camera.zoom);

  // Zoom by the distance ratio, pivoting on the midpoint. zoomTo's pivot must be
  // in the SVG-local coordinate space (see clientPointToLocalPoint /
  // useWheelPanZoom.ts for the same requirement with wheel+ctrl zoom).
  if (prev.dist > 0 && next.dist > 0) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pivot = clientPointToLocalPoint({ clientX: next.midX, clientY: next.midY }, rect);
    zoomTo(camera.zoom * (next.dist / prev.dist), pivot);
  }

  pinchState.current = next;
  return; // do not fall through to single-pointer tool move logic
}
```

Import `clientPointToLocalPoint` from `../pointer-coordinates` (already imported indirectly via
`svgWorldPoint`/`svgElementWorldPoint` in this file — check current imports, it may need to be
added directly).

### 2.4 `handlePointerUp` / add `handlePointerCancel`: cleanup

`use-whiteboard-pointer-handlers.ts` currently wires `onPointerDown/Move/Up/Leave` but **no
`onPointerCancel`** — add it now, since multi-touch meaningfully increases the chance of the
browser firing `pointercancel` (OS gesture takeover, e.g. a system back-swipe or notification
pull-down starting mid-gesture). Both `handlePointerUp` and the new cancel handler need the same
cleanup:

```ts
function releasePointer(pointerId: number) {
  activePointers.current.delete(pointerId);
  if (activePointers.current.size < 2) {
    pinchState.current = null;
    // Deliberately do NOT resume single-finger tool logic for whichever pointer
    // remains down — require a full lift + fresh pointerdown to start a new
    // single-finger action. Matches standard drawing-app UX (e.g. Excalidraw).
    if (activePointers.current.size === 0) setIsPanning(false);
  }
}
```

Call `releasePointer(event.pointerId)` at the start of both `handlePointerUp` and the new
`handlePointerCancel` (which can otherwise mirror `handlePointerUp`'s existing panStart-cleanup
branch — check whether tool-specific commit logic in the current `handlePointerUp` should also
run on cancel, or whether cancel should just discard drafts without committing; discarding is
almost certainly correct for a cancel, e.g. call the same `cancel*Draw()` functions used in
`handlePointerLeave` rather than the commit path used in normal `handlePointerUp`).

Wire the new handler into `svgLayerHandlers` (returned at the bottom of this hook) and pass it
through `SvgLayer.tsx`'s props/JSX as `onPointerCancel={onPointerCancel}` — check
`frontend/src/canvas/layers/svg/types.ts` for the `SvgLayerProps` interface, it will need a new
field.

Also make sure `handlePointerLeave` clears `activePointers`/`pinchState` for the departing
pointer if it fires instead of up/cancel (rare but possible at container edges) — reuse
`releasePointer`.

### 2.5 Edge cases to verify manually on a real device

- Start drawing a shape with one finger, add a second finger before lifting → shape draft
  should be discarded (not committed half-drawn), and the two fingers should immediately start
  panning/zooming.
- Two-finger pinch zoom in, then lift one finger, then put it back down elsewhere → should
  start a **fresh** single-finger action (draw/select) at the new location, not resume panning.
- Pinch zoom must respect existing `MIN_ZOOM`/`MAX_ZOOM` clamping — this is already enforced
  inside `zoomTo` in `frontend/src/store/camera.store.ts:46-57`, no extra clamping needed here.
- Three-finger touch (e.g. resting palm) shouldn't crash or produce erratic jumps — verify the
  "always use the first two tracked pointers" rule holds up when a 3rd is added/removed
  mid-gesture.
- Two-finger gesture while `tool === 'hand'` and while any draw tool — both must behave
  identically (pan+zoom), since two-finger behavior is tool-independent by design.

### 2.6 Testing

There's an existing `frontend/src/canvas/__tests__/zoom-pan.test.ts` — check whether it tests
`use-whiteboard-pointer-handlers.ts` directly or just `camera.store.ts`/`utils/camera.ts` math.
Add unit coverage for the new multi-touch tracking logic (pointer map add/remove, midpoint/
distance math, the 1→2→1 finger transition not resuming the old single-finger action) following
whatever pattern that existing test file uses. Manual on-device testing (real phone, not just
devtools touch emulation — pinch gestures don't emulate reliably in Chrome devtools) is required
before considering this done; devtools responsive mode is sufficient for Part 1's layout checks
but not for Part 2's gesture math.

## Suggested commit breakdown

Per `AGENTS.md` ("commit after each logical group of tasks"):

1. Part 1 tasks 1.1, 1.2, 1.4, 1.5, 1.6 together (all are small, independent, "make existing
   layout not break on a phone" fixes — natural single commit, or split 1-per-file if preferred).
2. Part 1 task 1.3 (bottom-sheet PanelShell) as its own commit if done — larger, more
   judgment-heavy change, easier to review/revert independently.
3. Part 1 task 1.7 (touch target sizing) as its own small commit if done.
4. Part 2 (two-finger pan/pinch-zoom) as one commit once 2.1-2.4 are all in and 2.5's edge cases
   are manually verified — this is one cohesive feature, don't split pointer-tracking from
   pan-math from cleanup across commits.

## Estimate

- Part 1 required (1.1, 1.2, 1.4, 1.5, 1.6): ~3-4 hours
- Part 1 recommended/optional (1.3, 1.7): ~2-3 hours
- Part 2 (two-finger pan + pinch-zoom): ~3-4 hours, plus real-device testing time (budget extra
  — gesture bugs are easy to miss in devtools emulation and only show up on an actual phone)
