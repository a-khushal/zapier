/*
  Warnings:

  - You are about to drop the column `triggerId` on the `Trigger` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Trigger" DROP CONSTRAINT "Trigger_triggerId_fkey";

-- AlterTable
ALTER TABLE "Trigger" DROP COLUMN "triggerId",
ADD COLUMN     "AvailableTriggerId" TEXT NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "Trigger" ADD CONSTRAINT "Trigger_AvailableTriggerId_fkey" FOREIGN KEY ("AvailableTriggerId") REFERENCES "AvailableTrigger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
