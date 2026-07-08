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

  it('creates a static benchmark verifier when BENCHMARK_AUTH_TOKEN is configured', async () => {
    const db = {} as Parameters<typeof createRuntimeAuthDeps>[0];
    const deps = createRuntimeAuthDeps(db, {
      BENCHMARK_AUTH_TOKEN: 'bench-token',
      BENCHMARK_AUTH_SUBJECT: 'bench-subject',
    });

    await expect(deps.authVerifier?.verify({ bearerToken: 'bench-token' })).resolves.toEqual({
      provider: 'benchmark',
      providerSubject: 'bench-subject',
      email: 'bench-subject@benchmark.local',
      name: 'Benchmark User',
      avatarUrl: null,
    });
    expect(deps.appUserRepository).toBeDefined();
  });
});
