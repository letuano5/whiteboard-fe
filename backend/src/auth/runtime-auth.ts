import type { PrismaClient } from '@prisma/client';
import { createPrismaAppUserRepository, type AppUserRepository } from './app-user-repository.js';
import {
  createSupabaseJwtAuthVerifier,
  type SupabaseJwtAuthVerifierOptions,
} from './supabase-jwt-auth-verifier.js';
import type { AuthVerifier } from './types.js';

interface RuntimeAuthEnv {
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_JWT_AUDIENCE?: string;
}

export interface RuntimeAuthDeps {
  authVerifier?: AuthVerifier;
  appUserRepository?: AppUserRepository;
}

export function createRuntimeAuthDeps(
  db: PrismaClient,
  env: RuntimeAuthEnv = process.env,
): RuntimeAuthDeps {
  const jwtSecret = readEnv(env.SUPABASE_JWT_SECRET);
  if (!jwtSecret) return {};

  const audience = readEnv(env.SUPABASE_JWT_AUDIENCE);
  const verifierOptions: SupabaseJwtAuthVerifierOptions = {
    jwtSecret,
    ...(audience ? { audience } : {}),
  };

  return {
    authVerifier: createSupabaseJwtAuthVerifier(verifierOptions),
    appUserRepository: createPrismaAppUserRepository(db),
  };
}

function readEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
