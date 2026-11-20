ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
CREATE TABLE "OAuthAccount" ("id" TEXT NOT NULL,"provider" TEXT NOT NULL,"providerUserId" TEXT NOT NULL,"userId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "OAuthAccount"("provider","providerUserId");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "OAuthTicket" ("id" TEXT NOT NULL,"codeHash" TEXT NOT NULL,"userId" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "OAuthTicket_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OAuthTicket_codeHash_key" ON "OAuthTicket"("codeHash");
CREATE INDEX "OAuthTicket_expiresAt_idx" ON "OAuthTicket"("expiresAt");
ALTER TABLE "OAuthTicket" ADD CONSTRAINT "OAuthTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
