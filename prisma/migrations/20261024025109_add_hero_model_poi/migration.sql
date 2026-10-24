-- CreateTable
CREATE TABLE "HeroModel" (
    "heroId" INTEGER NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "byteSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeroModel_pkey" PRIMARY KEY ("heroId")
);

-- CreateTable
CREATE TABLE "HeroPoi" (
    "id" SERIAL NOT NULL,
    "heroId" INTEGER NOT NULL,
    "anchor" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HeroPoi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeroPoi_heroId_idx" ON "HeroPoi"("heroId");

-- CreateIndex
CREATE UNIQUE INDEX "HeroPoi_heroId_anchor_key" ON "HeroPoi"("heroId", "anchor");

-- AddForeignKey
ALTER TABLE "HeroModel" ADD CONSTRAINT "HeroModel_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroPoi" ADD CONSTRAINT "HeroPoi_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
