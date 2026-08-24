ALTER TABLE "User" ADD COLUMN "ownerSingletonKey" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "User" ADD CONSTRAINT "User_ownerSingletonKey_check" CHECK ("ownerSingletonKey" = 1);

CREATE UNIQUE INDEX "User_ownerSingletonKey_key" ON "User"("ownerSingletonKey");
