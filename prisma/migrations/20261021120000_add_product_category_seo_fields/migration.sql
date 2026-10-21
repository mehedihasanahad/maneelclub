-- Per-product and per-category SEO overrides.
--
-- Additive only: every column is nullable with no default, so existing rows are
-- untouched and the storefront keeps falling back to title/description wherever
-- these are left empty. IF NOT EXISTS makes the migration safe to re-run.

-- AlterTable
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
