-- Initial Prisma schema for AI Octopus v2.x.
-- Review before applying to any existing database; intended for a fresh database.
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Scan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'ai',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "title" TEXT,
  "wordCount" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "rawResult" JSONB,
  "error" TEXT,
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Scan_userId_createdAt_idx" ON "Scan"("userId", "createdAt");
CREATE INDEX "Scan_providerId_idx" ON "Scan"("providerId");
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
