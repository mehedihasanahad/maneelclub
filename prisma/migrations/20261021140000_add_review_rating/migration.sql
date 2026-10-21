-- Star rating on customer reviews, used for AggregateRating structured data.
--
-- Additive and nullable: existing review screenshots keep a NULL rating and are
-- excluded from the average, so no product gains rating markup until an admin
-- actually enters ratings. Safe to re-run.

-- AlterTable
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "rating" INTEGER;

-- Guard against out-of-range values written by anything other than the app.
DO $$ BEGIN
    ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
