-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "VoteLicense" AS ENUM ('EVERYONE', 'INVITED', 'LOCATION');

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "voteLicense" "VoteLicense" NOT NULL DEFAULT 'EVERYONE',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusM" INTEGER,
    "voteStartsAt" TIMESTAMP(3),
    "voteEndsAt" TIMESTAMP(3),
    "currentEntryId" UUID,
    "currentStartedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvite" (
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "EventTrack" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "trackId" INTEGER NOT NULL,
    "suggestedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedAt" TIMESTAMP(3),

    CONSTRAINT "EventTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "eventTrackId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("eventTrackId","userId")
);

-- CreateIndex
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");

-- CreateIndex
CREATE INDEX "Event_visibility_createdAt_idx" ON "Event"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX "EventInvite_userId_idx" ON "EventInvite"("userId");

-- CreateIndex
CREATE INDEX "EventTrack_eventId_playedAt_idx" ON "EventTrack"("eventId", "playedAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTrack" ADD CONSTRAINT "EventTrack_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTrack" ADD CONSTRAINT "EventTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("deezerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTrack" ADD CONSTRAINT "EventTrack_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_eventTrackId_fkey" FOREIGN KEY ("eventTrackId") REFERENCES "EventTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One live (not yet played) entry per track and event.
CREATE UNIQUE INDEX "EventTrack_live_track_key" ON "EventTrack"("eventId", "trackId") WHERE "playedAt" IS NULL;
