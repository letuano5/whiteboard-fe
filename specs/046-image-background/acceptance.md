# Acceptance Criteria Registry: Image / Background Map (P2.5-01)

**Feature**: P2.5-01 Image / background map
**Spec**: `docs/SPECS.md` section `[P2.5-01]`
**Created**: 2026-07-03
**Status**: Frozen - append-only after this point

---

**AC-1**: Given a valid image URL, when the user inserts it from the image control, then a committed `image` element is created with `props.src` equal to that URL and it renders as an SVG `<image>` node on the whiteboard.

**AC-2**: Given an uploaded image file, when the user inserts it from the image control, then a committed `image` element is created with a base64 data URL in `props.src` and it renders as an SVG `<image>` node on the whiteboard.

**AC-3**: Given an inserted image element, when the user selects and moves or resizes it with the existing select tool, then its world-space bounds update through the mutation pipeline like other committed elements.

**AC-4**: Given existing whiteboard elements, when the user inserts an image as a background, then the new image is placed below every visible element in stacking order.
