/*
  Warnings:

  - You are about to drop the column `AvailableTriggerId` on the `Trigger` table. All the data in the column will be lost.
  - Added the required column `triggerId` to the `Trigger` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Trigger" DROP CONSTRAINT "Trigger_AvailableTriggerId_fkey";

-- AlterTable
ALTER TABLE "Trigger" DROP COLUMN "AvailableTriggerId",
ADD COLUMN     "triggerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Trigger" ADD CONSTRAINT "Trigger_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "AvailableTrigger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
