-- CreateTable
CREATE TABLE "Track" (
    "deezerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT NOT NULL,
    "coverUrl" TEXT,
    "previewUrl" TEXT,
    "durationSec" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("deezerId")
);
