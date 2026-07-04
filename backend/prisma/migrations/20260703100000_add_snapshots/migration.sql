CREATE TABLE "Snapshot" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "documentClock" BIGINT NOT NULL,
  "roomEpoch" BIGINT NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "records" JSONB NOT NULL,
  "tombstones" JSONB NOT NULL,

  CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Snapshot_roomId_createdAt_idx" ON "Snapshot"("roomId", "createdAt");
CREATE INDEX "Snapshot_roomId_documentClock_idx" ON "Snapshot"("roomId", "documentClock");

ALTER TABLE "Snapshot"
  ADD CONSTRAINT "Snapshot_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
