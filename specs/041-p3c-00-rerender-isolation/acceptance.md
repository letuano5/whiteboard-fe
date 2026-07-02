# Acceptance Criteria

AC-1: `Whiteboard.tsx` must not subscribe directly to `draftElement` or `draftElements`; draft
updates are owned by a child draft layer that subscribes only to the draft state it renders.

AC-2: Committed element rendering must be isolated so updating one point on a draft element does
not re-render unchanged committed shapes already on the canvas.

AC-3: Existing move/resize draft behavior must remain intact: the committed copy is hidden while
the draft copy renders, and the local selection overlay follows the draft bounds.
