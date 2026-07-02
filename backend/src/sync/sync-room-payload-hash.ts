/**
 * Canonical payload hashing for idempotency comparison. Object keys are sorted
 * recursively so semantically identical retries hash equally regardless of key order.
 */
export function toPayloadHash(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

function toCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCanonicalValue);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, toCanonicalValue(entryValue)]),
  );
}
