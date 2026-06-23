# Acceptance Criteria Registry — 003-style-and-text (P1A-04 + P1A-05)

> Append-only. Never renumber or repurpose existing AC-n entries.
> Tests must tag coverage with `@covers AC-n`.

## P1A-04: Basic Style Panel

AC-1: Selecting a shape displays the detail panel with editable controls.
AC-2: When no shape is selected, the detail panel is hidden (no editable controls shown).
AC-3: Changing stroke color via the detail panel immediately updates the shape's rendered outline color.
AC-4: Changing fill color via the detail panel immediately updates the shape's rendered fill.
AC-5: Changing stroke width via the detail panel immediately updates the shape's rendered outline thickness.
AC-6: Changing opacity via the detail panel immediately updates the shape's rendered opacity.
AC-7: Every style change goes through patchElement (version is incremented, versionNonce is re-randomized).
AC-8: Style changes persist — after deselecting and re-selecting the shape, the new style values are retained.

## P1A-05: Text Properties

AC-9: When a text element is selected, the detail panel shows font size, font family, and text alignment controls.
AC-10: When a non-text shape is selected, text-specific controls (font size, font family, text align) are NOT shown.
AC-11: Changing font size on a selected text element immediately updates the rendered text size.
AC-12: Changing font family on a selected text element immediately updates the rendered font.
AC-13: Setting text alignment to "left" renders the text anchored to the left of the bounding box.
AC-14: Setting text alignment to "center" renders the text centered within the bounding box.
AC-15: Setting text alignment to "right" renders the text anchored to the right of the bounding box.
AC-16: Text property changes (fontSize, fontFamily, textAlign) go through patchElement (version incremented).

## Bug Fixes (post-implementation)

AC-17: While a form control in the detail panel has keyboard focus (e.g., stroke width input), pressing Backspace or Delete does NOT delete the selected element — only edits the input field.
AC-18: Clicking any control in the detail panel (color picker, number input, range slider, select, buttons) does NOT deselect the currently selected element.
AC-19: Clicking the canvas with the text tool without dragging creates a text element at the click position with a default bounding box of 200px wide × 40px tall.
