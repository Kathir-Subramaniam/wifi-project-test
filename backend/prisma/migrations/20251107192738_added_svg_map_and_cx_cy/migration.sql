/*
  Warnings:

  - Added the required column `cx` to the `APs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cy` to the `APs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `svgMap` to the `Floors` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "APs" ADD COLUMN     "cx" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "cy" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "Floors" ADD COLUMN     "svgMap" TEXT NOT NULL;
