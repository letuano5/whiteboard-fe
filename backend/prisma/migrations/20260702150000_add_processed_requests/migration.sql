ALTER TABLE "Room"
ADD COLUMN "roomEpoch" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "processedRequestHistoryStartsAtClock" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "ProcessedRequest" (
    "roomId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "serverClock" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "ack" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedRequest_pkey" PRIMARY KEY ("roomId","actorId","requestId")
);

CREATE INDEX "ProcessedRequest_roomId_serverClock_idx" ON "ProcessedRequest"("roomId", "serverClock");
CREATE INDEX "ProcessedRequest_roomId_createdAt_idx" ON "ProcessedRequest"("roomId", "createdAt");

ALTER TABLE "ProcessedRequest"
ADD CONSTRAINT "ProcessedRequest_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
