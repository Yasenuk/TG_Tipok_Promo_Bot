-- CreateTable
CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ownerId" BIGINT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingAction_expiresAt_idx" ON "PendingAction"("expiresAt");
