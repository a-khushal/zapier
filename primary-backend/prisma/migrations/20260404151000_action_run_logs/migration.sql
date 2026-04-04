-- CreateEnum
CREATE TYPE "ZapRunStepStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "ZapRunStep" (
    "id" TEXT NOT NULL,
    "zapRunId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" "ZapRunStepStatus" NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ZapRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRecord" (
    "id" TEXT NOT NULL,
    "zapRunId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZapRunStep_zapRunId_idx" ON "ZapRunStep"("zapRunId");

-- CreateIndex
CREATE INDEX "ZapRunStep_actionId_idx" ON "ZapRunStep"("actionId");

-- CreateIndex
CREATE INDEX "ActionRecord_zapRunId_idx" ON "ActionRecord"("zapRunId");

-- CreateIndex
CREATE INDEX "ActionRecord_actionId_idx" ON "ActionRecord"("actionId");

-- AddForeignKey
ALTER TABLE "ZapRunStep" ADD CONSTRAINT "ZapRunStep_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZapRunStep" ADD CONSTRAINT "ZapRunStep_zapRunId_fkey" FOREIGN KEY ("zapRunId") REFERENCES "ZapRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRecord" ADD CONSTRAINT "ActionRecord_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRecord" ADD CONSTRAINT "ActionRecord_zapRunId_fkey" FOREIGN KEY ("zapRunId") REFERENCES "ZapRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
