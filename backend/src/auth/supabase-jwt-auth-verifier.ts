import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthVerifyError, type AuthVerifier, type VerifiedIdentity } from './types.js';

interface JwtHeader {
  alg: string;
}

interface JwtPayload {
  sub: string;
  exp?: number;
  aud?: string | string[];
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseJwtAuthVerifierOptions {
  jwtSecret: string;
  audience?: string;
  now?: () => Date;
}

export function createSupabaseJwtAuthVerifier(
  options: SupabaseJwtAuthVerifierOptions,
): AuthVerifier {
  const jwtSecret = options.jwtSecret.trim();
  if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET must not be empty.');
  }

  return {
    async verify({ bearerToken }) {
      if (!bearerToken) {
        throw new AuthVerifyError('missing-credentials', 'Missing bearer token.');
      }

      const [encodedHeader, encodedPayload, signature, extra] = bearerToken.split('.');
      if (!encodedHeader || !encodedPayload || !signature || extra) {
        throw invalidToken();
      }

      if (!isValidSignature(`${encodedHeader}.${encodedPayload}`, signature, jwtSecret)) {
        throw invalidToken();
      }

      const header = parseJwtPart<JwtHeader>(encodedHeader);
      const payload = parseJwtPart<JwtPayload>(encodedPayload);

      if (!header || header.alg !== 'HS256' || !payload || !isValidPayload(payload)) {
        throw invalidToken();
      }

      if (isExpired(payload, options.now?.() ?? new Date())) {
        throw invalidToken();
      }

      if (options.audience && !hasAudience(payload, options.audience)) {
        throw invalidToken();
      }

      return mapIdentity(payload);
    },
  };
}

function isValidSignature(message: string, signature: string, jwtSecret: string): boolean {
  const expected = createHmac('sha256', jwtSecret).update(message).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function parseJwtPart<T>(encoded: string): T | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function isValidPayload(payload: JwtPayload): boolean {
  return typeof payload.sub === 'string' && payload.sub.trim().length > 0;
}

function isExpired(payload: JwtPayload, now: Date): boolean {
  return typeof payload.exp === 'number' && payload.exp <= Math.floor(now.getTime() / 1000);
}

function hasAudience(payload: JwtPayload, audience: string): boolean {
  return Array.isArray(payload.aud) ? payload.aud.includes(audience) : payload.aud === audience;
}

function mapIdentity(payload: JwtPayload): VerifiedIdentity {
  const metadata = payload.user_metadata ?? {};

  return {
    provider: 'supabase',
    providerSubject: payload.sub,
    email: readString(payload.email) ?? readString(metadata.email),
    name: readString(metadata.name) ?? readString(metadata.full_name),
    avatarUrl: readString(metadata.avatar_url),
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function invalidToken(): AuthVerifyError {
  return new AuthVerifyError('invalid-credentials', 'Bearer token is invalid.');
}
