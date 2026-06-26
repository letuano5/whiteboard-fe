# Research: Laser Pointer (P1B-04)

No unknowns requiring external research. All decisions resolved from codebase context:

## Decision: Fade-out mechanism

- **Decision**: Two `setTimeout` timers per move event (reset on each move). At 1000ms: set `laserFading = true` (triggers CSS `opacity 0 transition`). At 1500ms: clear trail + reset `laserFading`.
- **Rationale**: CSS `transition: opacity 0.5s` gives smooth visual fade without RAF loop. Two timers let the fade start before trail is cleared. Resetting on each move keeps the trail fully visible while the user is active.
- **Alternatives considered**: RAF loop with per-point timestamps (more complex, would change Point[] type); CSS keyframe animation (hard to reset mid-animation without React key hack); single timer clear-all (abrupt, violates AC-2 "fades out").

## Decision: Trail rendering (SVG polyline)

- **Decision**: SVG `<polyline>` inside the existing camera-transformed `<g>` in SvgLayer.
- **Rationale**: The camera transform is already applied to the `<g>` element; world-coordinate points render correctly at any zoom. `<polyline>` is a single SVG element — minimal DOM overhead.
- **Alternatives considered**: Multiple `<line>` segments per point pair (more DOM nodes, no benefit); Canvas overlay (reserved for Phase 3C ink tools per CLAUDE.md).

## Decision: Max trail length

- **Decision**: Cap trail at 80 points (slice(-80) on each move).
- **Rationale**: Prevents unbounded array growth on rapid continuous movement. 80 points at typical mouse speed (~500px/s at 60fps) covers ~1.3 seconds of movement — more than enough for visual clarity.
- **Alternatives considered**: Unlimited (memory concern on fast movement); too small (trail looks choppy).

## Decision: Store additions

- **Decision**: Add `laserFading: boolean` to `InteractionState` and `interaction.store.ts`.
- **Rationale**: `laserFading` is transient UI state (animation flag) — belongs in interaction store per Constitution VII. SvgLayer reads it without holding local state (Constitution I). Minimal: one boolean field + one action.
- **Alternatives considered**: Component-level `useState` in Whiteboard (breaks "renderer holds no state"); module-level mutable variable (not reactive — SvgLayer wouldn't re-render); separate `laserFading` store (overkill).
