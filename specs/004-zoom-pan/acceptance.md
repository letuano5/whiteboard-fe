# Acceptance Criteria Registry — Zoom + Pan + Infinite Canvas

> Append-only. Never renumber or repurpose an existing AC-n.
> Source: specs/004-zoom-pan/spec.md

## Zoom via Scroll Wheel

AC-1: Scroll wheel up → zoom increases; the world point under the cursor remains at the same screen position (pivot-point zoom).
AC-2: Scroll up when zoom = 8 → zoom stays clamped at 8, no error.
AC-3: Scroll down when zoom = 0.1 → zoom stays clamped at 0.1, no error.
AC-4: Scroll wheel down → zoom decreases; world point under cursor stays fixed in screen space.

## Pan via Hand Tool

AC-5: Hand tool active + pointer down + drag by (Δx, Δy) screen pixels → camera x/y shifts by (-Δx/zoom, -Δy/zoom) in world units.
AC-6: Hand tool active + pointer up → panning stops and camera position is committed to the store.
AC-7: After panning to a world coordinate far from origin (e.g., x=5000, y=5000), shapes placed there become visible and interactive.

## Pan via Middle Mouse Button

AC-8: Middle mouse button (button 1) down + drag → camera pans regardless of active tool.
AC-9: Middle mouse button up → panning stops; active tool and selection state are unchanged.

## Temporary Pan via Space + Drag

AC-10: Space held + pointer drag → camera pans; no element is created or modified.
AC-11: Space released → original tool cursor resumes; no shape is drawn from the drag gesture.
AC-12: Space held while a text input / textarea / contenteditable has focus → Space types a character, pan does NOT activate.
