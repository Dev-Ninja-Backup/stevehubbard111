/*
  Warnings:

  - Made the column `s_id` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_s_id_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "s_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_s_id_fkey" FOREIGN KEY ("s_id") REFERENCES "security_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
