-- AlterTable
ALTER TABLE "Room"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "lastOpenedAt" TIMESTAMP(3),
  ADD COLUMN "createdBy" TEXT;

-- AlterTable
ALTER TABLE "RoomMember"
  ADD COLUMN "lastOpenedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RoomMember_userId_lastOpenedAt_idx" ON "RoomMember"("userId", "lastOpenedAt");
