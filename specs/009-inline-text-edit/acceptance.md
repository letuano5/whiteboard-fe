# Acceptance Criteria Registry — P1B-03 Inline Text Editing

<!-- APPEND-ONLY. Never renumber or repurpose an existing AC-n. -->
<!-- Tests must tag: @covers AC-n -->

AC-1: Double-clicking a `text`-type element while the select tool is active opens an inline contenteditable editor positioned over that element.
AC-2: Clicking outside the editor (blur) commits the current editor content to `props.text` via `patchElement`.
AC-3: Pressing the Escape key while the editor is focused commits the current editor content to `props.text` via `patchElement` and closes the editor.
AC-4: After the editor closes (blur or Escape), the element's `width` and `height` are updated to match the rendered text dimensions (auto-bbox).
AC-5: The inline editor is positioned and scaled so that its text visually aligns with the element's position at the current camera zoom level.
AC-6: If the user clears all text and blurs, the element remains with `props.text === ""` (element is NOT deleted).
AC-7: Double-clicking a non-`text` element (e.g., rectangle, ellipse) does NOT open the inline editor.
AC-8: While the inline editor is open, `editingId` in the interaction store equals the element's id; after the editor closes, `editingId` is `null`.
