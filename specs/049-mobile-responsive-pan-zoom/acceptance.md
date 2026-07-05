# Acceptance Criteria Registry — 049-mobile-responsive-pan-zoom

> Tests must tag coverage with `@covers AC-n` or `@covers AC-n (049-mobile-responsive-pan-zoom)`.

AC-1: The main toolbar, action toolbar, and more-tools popup are width-clamped to the viewport and horizontally scrollable so all buttons remain reachable on narrow phones.

AC-2: The shared floating panel shell has a viewport-aware max-width clamp while preserving its existing vertical scrolling behavior.

AC-3: The context menu measures its rendered size and clamps its fixed position inside the visible viewport with a small margin.

AC-4: The whiteboard app uses the dynamic viewport height and enables safe-area-aware edge offsets for fixed screen-edge controls.

AC-5: A two-pointer gesture on the SVG whiteboard always pans by midpoint movement and pinch-zooms around the gesture midpoint, regardless of the active tool.

AC-6: When a second pointer lands during an in-progress single-pointer edit, the edit is canceled or committed according to the existing tool cleanup path, and the remaining pointers are suppressed until every gesture pointer lifts.

AC-7: Pointer cancel and pointer leave clean up multi-touch gesture state without committing a canceled drawing interaction.
