-- CreateTable
CREATE TABLE "Patch" (
    "id" SERIAL NOT NULL,
    "clientVersion" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hero" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "apiId" INTEGER,
    "name" TEXT NOT NULL,
    "complexity" INTEGER,
    "tagline" TEXT,
    "summary" TEXT,
    "officialRole" TEXT,
    "officialPlaystyle" TEXT,
    "officialLore" TEXT,
    "accent" TEXT,
    "accentText" TEXT,
    "onAccent" TEXT,
    "apiAccent" TEXT,
    "accentSource" TEXT NOT NULL DEFAULT 'default',
    "palette" JSONB,
    "paletteOverride" JSONB,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "artwork" JSONB,
    "sourceLinks" JSONB,
    "startingStats" JSONB,
    "heroStatsUi" JSONB,
    "statsDisplay" JSONB,
    "shopStatDisplay" JSONB,
    "itemSlots" JSONB,
    "itemSlotInfo" JSONB,
    "physics" JSONB,
    "tags" JSONB,
    "removedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroSnapshot" (
    "id" SERIAL NOT NULL,
    "heroId" INTEGER NOT NULL,
    "patchId" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,

    CONSTRAINT "HeroSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ability" (
    "id" SERIAL NOT NULL,
    "className" TEXT NOT NULL,
    "apiId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "image" TEXT,
    "imageWebp" TEXT,
    "videos" JSONB,
    "behaviours" JSONB,
    "dependantAbilities" JSONB,
    "description" JSONB,
    "properties" JSONB,
    "upgrades" JSONB,
    "removedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroAbility" (
    "id" SERIAL NOT NULL,
    "heroId" INTEGER NOT NULL,
    "abilityId" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isInnate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HeroAbility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbilitySnapshot" (
    "id" SERIAL NOT NULL,
    "abilityId" INTEGER NOT NULL,
    "patchId" INTEGER NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "AbilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "className" TEXT,
    "apiId" TEXT,
    "name" TEXT NOT NULL,
    "nameSource" TEXT NOT NULL DEFAULT 'api',
    "itemType" TEXT,
    "slotType" TEXT,
    "tier" INTEGER,
    "cost" INTEGER,
    "shopable" BOOLEAN,
    "shopVersion" INTEGER,
    "startTrained" BOOLEAN,
    "image" TEXT,
    "imageWebp" TEXT,
    "shopImage" TEXT,
    "accent" TEXT,
    "accentText" TEXT,
    "onAccent" TEXT,
    "apiAccent" TEXT,
    "accentSource" TEXT NOT NULL DEFAULT 'default',
    "palette" JSONB,
    "paletteOverride" JSONB,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "description" JSONB,
    "properties" JSONB,
    "upgrades" JSONB,
    "tooltipSections" JSONB,
    "activation" JSONB,
    "imbue" JSONB,
    "disabled" BOOLEAN,
    "removedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemSnapshot" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "patchId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ItemSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" SERIAL NOT NULL,
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faction" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "sourceUrl" TEXT,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "summary" TEXT,
    "sourceUrl" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroPlayStat" (
    "id" SERIAL NOT NULL,
    "heroId" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "matches" INTEGER NOT NULL,

    CONSTRAINT "HeroPlayStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patch_clientVersion_key" ON "Patch"("clientVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Hero_slug_key" ON "Hero"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Hero_apiId_key" ON "Hero"("apiId");

-- CreateIndex
CREATE INDEX "Hero_name_idx" ON "Hero"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HeroSnapshot_heroId_patchId_key" ON "HeroSnapshot"("heroId", "patchId");

-- CreateIndex
CREATE UNIQUE INDEX "Ability_className_key" ON "Ability"("className");

-- CreateIndex
CREATE UNIQUE INDEX "Ability_apiId_key" ON "Ability"("apiId");

-- CreateIndex
CREATE INDEX "Ability_name_idx" ON "Ability"("name");

-- CreateIndex
CREATE INDEX "HeroAbility_abilityId_idx" ON "HeroAbility"("abilityId");

-- CreateIndex
CREATE UNIQUE INDEX "HeroAbility_heroId_slot_key" ON "HeroAbility"("heroId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "AbilitySnapshot_abilityId_patchId_key" ON "AbilitySnapshot"("abilityId", "patchId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_slug_key" ON "Item"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Item_className_key" ON "Item"("className");

-- CreateIndex
CREATE UNIQUE INDEX "Item_apiId_key" ON "Item"("apiId");

-- CreateIndex
CREATE INDEX "Item_slotType_idx" ON "Item"("slotType");

-- CreateIndex
CREATE INDEX "Item_tier_idx" ON "Item"("tier");

-- CreateIndex
CREATE INDEX "Item_itemType_idx" ON "Item"("itemType");

-- CreateIndex
CREATE UNIQUE INDEX "ItemSnapshot_itemId_patchId_key" ON "ItemSnapshot"("itemId", "patchId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_fromId_toId_type_key" ON "Relationship"("fromId", "toId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_slug_key" ON "Faction"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HeroPlayStat_heroId_windowStart_windowEnd_key" ON "HeroPlayStat"("heroId", "windowStart", "windowEnd");

-- AddForeignKey
ALTER TABLE "HeroSnapshot" ADD CONSTRAINT "HeroSnapshot_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroSnapshot" ADD CONSTRAINT "HeroSnapshot_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "Patch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroAbility" ADD CONSTRAINT "HeroAbility_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroAbility" ADD CONSTRAINT "HeroAbility_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilitySnapshot" ADD CONSTRAINT "AbilitySnapshot_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbilitySnapshot" ADD CONSTRAINT "AbilitySnapshot_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "Patch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSnapshot" ADD CONSTRAINT "ItemSnapshot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSnapshot" ADD CONSTRAINT "ItemSnapshot_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "Patch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroPlayStat" ADD CONSTRAINT "HeroPlayStat_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
