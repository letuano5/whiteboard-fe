# Research: Back to Content & Trackpad Support

## Decision 1 — Wheel event zoom/pan distinction

**Decision**: Use `WheelEvent.ctrlKey` as the zoom/pan switch.

**Rationale**: Browsers set `ctrlKey = true` for both Ctrl/Cmd + mouse wheel AND trackpad pinch (synthetic ctrlKey). This is the reliable cross-browser standard. No other detection (delta size heuristics, `GestureEvent`, `isPinch`) is necessary or portable.

**Alternatives considered**:
- Delta magnitude heuristics: fragile, device-dependent.
- `GestureEvent` (Safari-only): not cross-browser.

---

## Decision 2 — Zoom sensitivity

**Decision**: `factor = Math.exp(-normalizedDelta * 0.001)`

**Rationale**: Continuous exponential formula vs. fixed 10% step gives proportional feel. SENSITIVITY = 0.001 keeps mouse wheel at ~9.5% per notch (close to original 10%) while trackpad pinch ticks (~3px) produce ~0.3% per frame — a much smoother experience. Satisfies AC-8 (≤ 0.01 per raw unit).

**Alternatives considered**:
- Keep fixed 1.1 factor for both: too jumpy for trackpad.
- Clamp delta then apply larger sensitivity: adds complexity without benefit.

---

## Decision 3 — deltaMode normalization

**Decision**: Multiply delta by 16 (LINE mode) or container dimension (PAGE mode) before using.

**Rationale**: `deltaMode=0` (pixels) is the common case. LINE and PAGE modes need normalization to maintain consistent pan/zoom speed across input devices.

---

## Decision 4 — Viewport dimensions

**Decision**: `containerRef.current.getBoundingClientRect()` at time of use.

**Rationale**: The container div fills the entire window (100% width/height). Reading the bounding rect when needed avoids maintaining a separate ResizeObserver state. The read happens at most once per user click (for fit) or once per render cycle (for visibility check via useMemo).

---

## Decision 5 — Fit-to-content formula

**Decision**: `zoom = clamp(min(W × 0.85 / contentW, H × 0.85 / contentH), 0.1, 8)`, camera centered on content bbox.

**Rationale**: 85% viewport fill (7.5% padding each side) gives a comfortable view. Using the minimum of x- and y-zoom ensures no content is cropped. Camera x/y derived to center the content bbox.

---

## Decision 6 — No new Zustand state for visibility

**Decision**: Compute `showBackToContent` and `showHint` inline in Whiteboard.tsx using existing store subscriptions.

**Rationale**: These are pure derived booleans from existing state (elements + camera + tool). Adding them to a store would be premature — they're view-layer concerns, not committed or transient interaction state.
