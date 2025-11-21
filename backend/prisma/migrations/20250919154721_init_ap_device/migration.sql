-- CreateTable
CREATE TABLE "public"."AP" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "AP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Device" (
    "id" BIGSERIAL NOT NULL,
    "mac" VARCHAR(255) NOT NULL,
    "apId" BIGINT,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_mac_key" ON "public"."Device"("mac");

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_apId_fkey" FOREIGN KEY ("apId") REFERENCES "public"."AP"("id") ON DELETE SET NULL ON UPDATE CASCADE;
