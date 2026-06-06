-- CreateEnum
CREATE TYPE "SeatWaitlistStatus" AS ENUM ('ACTIVE', 'CANCELED', 'NOTIFIED');

-- AlterTable
ALTER TABLE "UserProfile"
  ADD COLUMN "telegramUsername" VARCHAR(64),
  ADD COLUMN "disclaimerAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disclaimerAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "disclaimerVersion" VARCHAR(32),
  DROP COLUMN "phone",
  DROP COLUMN "email";

-- CreateTable
CREATE TABLE "SeatWaitlistSubscription" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "SeatWaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeMarker" INTEGER DEFAULT 1,
    "notifiedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SeatWaitlistSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserProfile_telegramUsername_idx" ON "UserProfile"("telegramUsername");

-- CreateIndex
CREATE UNIQUE INDEX "uq_event_user_active_waitlist" ON "SeatWaitlistSubscription"("eventId", "userId", "activeMarker");

-- CreateIndex
CREATE INDEX "SeatWaitlistSubscription_eventId_status_createdAt_idx" ON "SeatWaitlistSubscription"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SeatWaitlistSubscription_userId_status_idx" ON "SeatWaitlistSubscription"("userId", "status");

-- CreateIndex
CREATE INDEX "SeatWaitlistSubscription_deletedAt_idx" ON "SeatWaitlistSubscription"("deletedAt");

-- AddForeignKey
ALTER TABLE "SeatWaitlistSubscription" ADD CONSTRAINT "SeatWaitlistSubscription_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatWaitlistSubscription" ADD CONSTRAINT "SeatWaitlistSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
