/*
  Warnings:

  - Added the required column `s_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "s_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_s_id_fkey" FOREIGN KEY ("s_id") REFERENCES "security_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
