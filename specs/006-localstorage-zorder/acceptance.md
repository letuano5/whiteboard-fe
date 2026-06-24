# Acceptance Criteria Registry — 006-localstorage-zorder (P1A-09 + P1A-10)

> Append-only. Never renumber or repurpose existing AC-n entries.
> Tests must tag coverage with `@covers AC-n` or `@covers AC-n (006-localstorage-zorder)`.

## P1A-09: localStorage Persistence (Single Tab)

AC-1: When the page is reloaded after shapes have been created, all non-deleted shapes are present with the same type, position, size, and style properties as before the reload.

AC-2: When the page is reloaded after the camera has been panned and/or zoomed, the camera x, y, and zoom values are restored to the values they had before the reload.

AC-3: When the page is reloaded after a shape has been soft-deleted (isDeleted: true), that shape does NOT reappear on the visible canvas.

AC-4: A shape created at least ~300 ms before a page reload is successfully restored after that reload (the debounce write completes within the 300 ms window).

AC-5: When the page loads with no previously saved data in storage, the canvas initialises with an empty elements array and the default camera without throwing any error.

AC-6: When the page loads and stored data is corrupted or invalid JSON, the canvas falls back to an empty state without throwing any error.

AC-7: The persisted data includes every field of every Element (all properties are round-tripped faithfully: id, type, x, y, width, height, angle, zIndex, props, version, versionNonce, updatedAt, isDeleted, groupId, frameId, locked, createdBy).

## P1A-10: Z-Order Foundation

AC-8: Given two overlapping shapes where shape B has a higher zIndex than shape A, shape B is rendered visually on top of shape A in the overlapping area.

AC-9: Given two overlapping shapes where shape B has a higher zIndex than shape A, clicking in the overlapping area selects shape B (not shape A).

AC-10: Every newly created shape is assigned a zIndex strictly greater than the maximum zIndex of all existing shapes on the canvas at the time of creation.

AC-11: The first shape created on an empty canvas receives a zIndex of 1 (i.e., max of empty set = 0, new zIndex = 0 + 1 = 1).
