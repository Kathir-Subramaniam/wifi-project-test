/*
  Warnings:

  - A unique constraint covering the columns `[apNumber]` on the table `AP` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `apNumber` to the `AP` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."AP" ADD COLUMN     "apNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AP_apNumber_key" ON "public"."AP"("apNumber");
