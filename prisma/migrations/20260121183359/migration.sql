/*
  Warnings:

  - You are about to drop the column `s_id` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_s_id_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "s_id";
