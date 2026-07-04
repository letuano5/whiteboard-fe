import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createPrismaAppUserRepository, type AppUser, type VerifiedIdentity } from './index.js';

const identity: VerifiedIdentity = {
  provider: 'supabase',
  providerSubject: 'user-123',
  email: 'player@example.com',
  name: 'Tactical Player',
  avatarUrl: 'https://example.test/avatar.png',
};

const appUser: AppUser = {
  id: 'app-user-123',
  provider: 'supabase',
  providerSubject: 'user-123',
  email: 'player@example.com',
  name: 'Tactical Player',
  avatarUrl: 'https://example.test/avatar.png',
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

describe('createPrismaAppUserRepository', () => {
  it('upserts an app-owned user from a verified identity', async () => {
    const upsert = vi.fn().mockResolvedValue(appUser);
    const db = {
      appUser: { upsert },
    } as unknown as PrismaClient;
    const repository = createPrismaAppUserRepository(db);

    await expect(repository.upsertFromIdentity(identity)).resolves.toEqual(appUser);

    expect(upsert).toHaveBeenCalledWith({
      where: {
        provider_providerSubject: {
          provider: 'supabase',
          providerSubject: 'user-123',
        },
      },
      create: {
        provider: 'supabase',
        providerSubject: 'user-123',
        email: 'player@example.com',
        name: 'Tactical Player',
        avatarUrl: 'https://example.test/avatar.png',
      },
      update: {
        email: 'player@example.com',
        name: 'Tactical Player',
        avatarUrl: 'https://example.test/avatar.png',
      },
    });
  });
});
