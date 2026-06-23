# Research: Basic Style Panel & Text Properties (P1A-04 + P1A-05)

## Findings

All stack knowledge was already recorded in CLAUDE.md; no external fetch required.

### Decision: Native HTML inputs for style controls

- **Chosen**: `<input type="color">`, `<input type="range">`, `<input type="number">`, `<select>` — all native browser inputs, no third-party color-picker library.
- **Rationale**: Zero new dependencies; native `<input type="color">` covers the MVP requirement; styling controls do not need to be pixel-perfect for P1A.
- **Alternatives considered**: react-color, Radix UI color picker — rejected because they add bundle weight and require setup not in the current stack.

### Decision: SVG text anchor for textAlign

- **Chosen**: Map `textAlign` to SVG `x` coordinate + `textAnchor` together:
  - `left` → `x = element.x`, `textAnchor='start'`
  - `center` → `x = element.x + width/2`, `textAnchor='middle'`
  - `right` → `x = element.x + width`, `textAnchor='end'`
- **Rationale**: SVG `textAnchor` positions text relative to the anchor point; fixing x per alignment gives correct bounding-box-relative alignment.
- **Alternatives considered**: CSS `text-anchor` via foreignObject — rejected as unnecessary complexity; SVG-native attributes suffice.

### Decision: Panel positioning

- **Chosen**: `position: fixed`, right side, vertically centered (`top:50%; transform:translateY(-50%)`).
- **Rationale**: Does not push canvas layout; always visible alongside selected shape; standard property-panel UX (Figma, Excalidraw).
- **Alternatives considered**: Left side, bottom bar, floating near selection — right side is least likely to obscure a selected shape (most tools by convention put property panels on the right).
