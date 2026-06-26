# Data Model: Laser Pointer (P1B-04)

## LaserTrail (transient, in interaction store)

| Field | Type | Description |
|-------|------|-------------|
| `laserTrail` | `Point[]` | Ordered world-coordinate points of the current trail. Max 80 entries. Already in `InteractionState`. |
| `laserFading` | `boolean` | `true` during the 0.5s CSS opacity transition before trail is cleared. **New field** added to `InteractionState`. |

**State transitions:**

```
IDLE (laserTrail=[], laserFading=false)
  → pointer moves while laser active
ACTIVE (laserTrail=[...pts], laserFading=false)
  → 1000ms after last move
FADING (laserTrail=[...pts], laserFading=true, opacity transitioning 1→0)
  → 500ms later (total 1500ms after last move)
IDLE (laserTrail=[], laserFading=false)
  → or: user switches tool → immediately back to IDLE
  → or: pointer leaves canvas → immediately back to IDLE
```

## No persistent entities

Laser trail is never written to localStorage, elements store, or any sync channel. No schema changes required.
