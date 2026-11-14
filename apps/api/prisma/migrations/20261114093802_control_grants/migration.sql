-- CreateTable
CREATE TABLE "ControlGrant" (
    "deviceId" UUID NOT NULL,
    "granteeId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlGrant_pkey" PRIMARY KEY ("deviceId","granteeId")
);

-- CreateIndex
CREATE INDEX "ControlGrant_granteeId_idx" ON "ControlGrant"("granteeId");

-- AddForeignKey
ALTER TABLE "ControlGrant" ADD CONSTRAINT "ControlGrant_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlGrant" ADD CONSTRAINT "ControlGrant_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
