-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "friendsInfo" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "musicPrefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "privateInfo" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "publicInfo" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "Friendship" (
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("userAId","userBId")
);

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx" ON "Friendship"("userBId");

-- CreateIndex
CREATE INDEX "User_displayName_idx" ON "User"("displayName");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
