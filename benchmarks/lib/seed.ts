import { randomUUID } from 'node:crypto';

interface BenchmarkPrisma {
  appUser: {
    upsert: (args: unknown) => Promise<{ id: string }>;
  };
  room: {
    upsert: (args: unknown) => Promise<{ id: string }>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  roomMember: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  $disconnect: () => Promise<void>;
}

export interface SeedResult {
  roomIds: string[];
  authMode: 'database-link-edit' | 'provided-room-ids' | 'generated-ephemeral';
  userId?: string;
  notes: string[];
}

export async function seedBenchmarkRooms(input: {
  roomIds: string[];
  roomCount: number;
  prefix: string;
  cleanup: boolean;
}): Promise<SeedResult> {
  await loadRootEnv();

  if (input.roomIds.length > 0) {
    return { roomIds: input.roomIds, authMode: 'provided-room-ids', notes: [] };
  }

  if (!process.env.DATABASE_URL) {
    return {
      roomIds: Array.from({ length: input.roomCount }, () => randomUUID()),
      authMode: 'generated-ephemeral',
      notes: ['DATABASE_URL is not set; generated ephemeral room ids without DB seeding.'],
    };
  }

  const prisma = await loadPrisma();
  const user = await prisma.appUser.upsert({
    where: { provider_providerSubject: { provider: 'benchmark', providerSubject: input.prefix } },
    update: { email: `${input.prefix}@benchmark.local`, name: 'Benchmark User' },
    create: {
      provider: 'benchmark',
      providerSubject: input.prefix,
      email: `${input.prefix}@benchmark.local`,
      name: 'Benchmark User',
    },
    select: { id: true },
  });

  if (input.cleanup) {
    await prisma.room.deleteMany({ where: { name: { startsWith: input.prefix } } });
  }

  const roomIds: string[] = [];
  for (let index = 0; index < input.roomCount; index += 1) {
    const id = randomUUID();
    const room = await prisma.room.upsert({
      where: { id },
      update: {
        name: `${input.prefix}-${index}`,
        ownerId: user.id,
        createdBy: user.id,
        visibility: 'link_edit',
        archivedAt: null,
        maxParticipants: null,
        maxEditors: null,
      },
      create: {
        id,
        name: `${input.prefix}-${index}`,
        ownerId: user.id,
        createdBy: user.id,
        visibility: 'link_edit',
      },
      select: { id: true },
    });
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      update: { role: 'owner' },
      create: { roomId: room.id, userId: user.id, role: 'owner' },
    });
    roomIds.push(room.id);
  }

  return {
    roomIds,
    authMode: 'database-link-edit',
    userId: user.id,
    notes: ['Seeded benchmark rooms as link_edit so anonymous socket clients can mutate.'],
  };
}

export async function disconnectSeedDb(): Promise<void> {
  await loadRootEnv();
  if (!process.env.DATABASE_URL) return;
  const prisma = await loadPrisma();
  await prisma.$disconnect();
}

async function loadRootEnv(): Promise<void> {
  await import('../../backend/src/config/load-root-env.js');
}

async function loadPrisma(): Promise<BenchmarkPrisma> {
  const module = (await import('../../backend/src/persistence/prisma.js')) as {
    prisma: BenchmarkPrisma;
  };
  return module.prisma;
}
