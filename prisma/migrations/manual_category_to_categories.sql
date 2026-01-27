-- Manual migration: Convert single category to categories array
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new

-- Step 1: Add the new categories column as an array (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Listing' AND column_name = 'categories'
    ) THEN
        ALTER TABLE "Listing" ADD COLUMN "categories" "Category"[] DEFAULT '{}';
    END IF;
END $$;

-- Step 2: Migrate data from category to categories (if category column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Listing' AND column_name = 'category'
    ) THEN
        -- Copy category values to categories array
        UPDATE "Listing"
        SET "categories" = ARRAY["category"]::text[]::"Category"[]
        WHERE "category" IS NOT NULL AND ("categories" IS NULL OR "categories" = '{}');

        -- Drop the old category column
        ALTER TABLE "Listing" DROP COLUMN IF EXISTS "category";
    END IF;
END $$;

-- Step 3: Create index on categories (if it doesn't exist)
CREATE INDEX IF NOT EXISTS "Listing_categories_idx" ON "Listing" USING GIN ("categories");

-- Step 4: Remove old category index if it exists
DROP INDEX IF EXISTS "Listing_category_idx";

-- Verify the migration
SELECT
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'Listing'
AND column_name IN ('category', 'categories');
