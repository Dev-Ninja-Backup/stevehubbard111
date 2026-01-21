-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_s_id_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "s_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_s_id_fkey" FOREIGN KEY ("s_id") REFERENCES "security_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
