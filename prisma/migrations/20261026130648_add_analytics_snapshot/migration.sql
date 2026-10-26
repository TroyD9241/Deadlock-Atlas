-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "paramsHash" TEXT NOT NULL,
    "rankBracket" TEXT NOT NULL DEFAULT 'all',
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_fetchedAt_idx" ON "AnalyticsSnapshot"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_endpoint_paramsHash_rankBracket_key" ON "AnalyticsSnapshot"("endpoint", "paramsHash", "rankBracket");
