-- This is an empty migration.
CREATE UNIQUE INDEX "content_global_key_locale"
  ON "Content" ("key", "locale") WHERE "campaignId" IS NULL;