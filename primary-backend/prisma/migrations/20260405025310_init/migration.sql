/*
  Warnings:

  - You are about to drop the `ActionRecord` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ActionRecord" DROP CONSTRAINT "ActionRecord_actionId_fkey";

-- DropForeignKey
ALTER TABLE "ActionRecord" DROP CONSTRAINT "ActionRecord_zapRunId_fkey";

-- DropTable
DROP TABLE "ActionRecord";
