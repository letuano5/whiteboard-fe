ALTER TABLE "Room" ADD COLUMN "shareRevokedAt" TIMESTAMP(3);

CREATE TABLE "RoomInvitation" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "invitedBy" TEXT NOT NULL,
  "claimedBy" TEXT,
  "claimedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoomInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomInvitation_roomId_email_key" ON "RoomInvitation"("roomId", "email");
CREATE INDEX "RoomInvitation_email_revokedAt_claimedAt_idx" ON "RoomInvitation"("email", "revokedAt", "claimedAt");

ALTER TABLE "RoomInvitation"
  ADD CONSTRAINT "RoomInvitation_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomInvitation"
  ADD CONSTRAINT "RoomInvitation_invitedBy_fkey"
  FOREIGN KEY ("invitedBy") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomInvitation"
  ADD CONSTRAINT "RoomInvitation_claimedBy_fkey"
  FOREIGN KEY ("claimedBy") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
