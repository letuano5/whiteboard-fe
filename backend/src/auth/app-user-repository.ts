import type { PrismaClient } from '@prisma/client';
import type { VerifiedIdentity } from './types.js';

export interface AppUser {
  id: string;
  provider: string;
  providerSubject: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppUserRepository {
  upsertFromIdentity(identity: VerifiedIdentity): Promise<AppUser>;
}

export function createPrismaAppUserRepository(db: PrismaClient): AppUserRepository {
  return {
    upsertFromIdentity(identity) {
      const profile = {
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      };

      return db.appUser.upsert({
        where: {
          provider_providerSubject: {
            provider: identity.provider,
            providerSubject: identity.providerSubject,
          },
        },
        create: {
          provider: identity.provider,
          providerSubject: identity.providerSubject,
          ...profile,
        },
        update: profile,
      });
    },
  };
}
