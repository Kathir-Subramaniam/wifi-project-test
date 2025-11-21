-- DropForeignKey
ALTER TABLE "public"."APs" DROP CONSTRAINT "APs_floorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Clients" DROP CONSTRAINT "Clients_apId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Floors" DROP CONSTRAINT "Floors_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GlobalPermissions" DROP CONSTRAINT "GlobalPermissions_buildingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GlobalPermissions" DROP CONSTRAINT "GlobalPermissions_floorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GlobalPermissions" DROP CONSTRAINT "GlobalPermissions_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserDevices" DROP CONSTRAINT "UserDevices_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserGroups" DROP CONSTRAINT "UserGroups_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserGroups" DROP CONSTRAINT "UserGroups_userId_fkey";

-- AlterTable
ALTER TABLE "Roles" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "APs" ADD CONSTRAINT "APs_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floors" ADD CONSTRAINT "Floors_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevices" ADD CONSTRAINT "UserDevices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clients" ADD CONSTRAINT "Clients_apId_fkey" FOREIGN KEY ("apId") REFERENCES "APs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroups" ADD CONSTRAINT "UserGroups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroups" ADD CONSTRAINT "UserGroups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalPermissions" ADD CONSTRAINT "GlobalPermissions_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalPermissions" ADD CONSTRAINT "GlobalPermissions_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalPermissions" ADD CONSTRAINT "GlobalPermissions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
