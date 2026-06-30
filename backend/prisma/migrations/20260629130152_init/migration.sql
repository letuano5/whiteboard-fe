-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled',
    "ownerId" TEXT,
    "documentClock" BIGINT NOT NULL DEFAULT 0,
    "tombstoneHistoryStartsAtClock" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "Record" (
    "roomId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "recordClock" BIGINT NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("roomId","recordId")
);

-- CreateTable
CREATE TABLE "Tombstone" (
    "roomId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "deletedClock" BIGINT NOT NULL,

    CONSTRAINT "Tombstone_pkey" PRIMARY KEY ("roomId","recordId")
);

-- CreateIndex
CREATE INDEX "Record_roomId_recordClock_idx" ON "Record"("roomId", "recordClock");

-- CreateIndex
CREATE INDEX "Tombstone_roomId_deletedClock_idx" ON "Tombstone"("roomId", "deletedClock");

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tombstone" ADD CONSTRAINT "Tombstone_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
