-- AlterTable
ALTER TABLE "ZapRunStep" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ZapRunStepAttempt" (
    "id" TEXT NOT NULL,
    "zapRunStepId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "requestSummary" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZapRunStepAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZapRunStepAttempt_zapRunStepId_idx" ON "ZapRunStepAttempt"("zapRunStepId");

-- AddForeignKey
ALTER TABLE "ZapRunStepAttempt" ADD CONSTRAINT "ZapRunStepAttempt_zapRunStepId_fkey" FOREIGN KEY ("zapRunStepId") REFERENCES "ZapRunStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
