-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "draftBucketing" JSONB,
ADD COLUMN     "popularItems" JSONB;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "isActive" BOOLEAN,
ADD COLUMN     "shopFilters" TEXT[],
ADD COLUMN     "weaponInfo" JSONB;
