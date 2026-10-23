-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "isDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInDevelopment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReleased" BOOLEAN NOT NULL DEFAULT false;
