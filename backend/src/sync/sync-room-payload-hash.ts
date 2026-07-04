import { createHash } from 'node:crypto';

/**
 * Canonical payload hashing for idempotency comparison. Object keys are sorted
 * recursively so semantically identical retries hash equally regardless of key order.
 */
export function toPayloadHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(toCanonicalValue(value)))
    .digest('hex');
}

export function toCommandPayloadHash(value: unknown): string {
  return toPayloadHash(stripClientOnlyCommandMetadata(value));
}

function stripClientOnlyCommandMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripClientOnlyCommandMetadata);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !CLIENT_ONLY_COMMAND_KEYS.has(key))
      .map(([key, entryValue]) => [key, stripClientOnlyCommandMetadata(entryValue)]),
  );
}

const CLIENT_ONLY_COMMAND_KEYS = new Set(['actorId', 'debug', 'persistence', 'transient']);

function toCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCanonicalValue);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, toCanonicalValue(entryValue)]),
  );
}
