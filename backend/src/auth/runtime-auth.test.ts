import { describe, expect, it } from 'vitest';
import { createRuntimeAuthDeps } from './index.js';

describe('createRuntimeAuthDeps', () => {
  it('returns no auth deps when SUPABASE_JWT_SECRET is absent', () => {
    const db = {} as Parameters<typeof createRuntimeAuthDeps>[0];

    expect(createRuntimeAuthDeps(db, {})).toEqual({});
  });

  it('creates verifier and app-user repository when SUPABASE_JWT_SECRET is configured', () => {
    const db = {} as Parameters<typeof createRuntimeAuthDeps>[0];
    const deps = createRuntimeAuthDeps(db, {
      SUPABASE_JWT_SECRET: 'local-supabase-jwt-secret-with-enough-entropy',
    });

    expect(deps.authVerifier).toBeDefined();
    expect(deps.appUserRepository).toBeDefined();
  });
});
