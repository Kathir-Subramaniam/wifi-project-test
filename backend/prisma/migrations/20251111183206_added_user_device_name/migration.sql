/*
  Warnings:

  - Added the required column `name` to the `UserDevices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserDevices" ADD COLUMN     "name" VARCHAR(255) NOT NULL;
