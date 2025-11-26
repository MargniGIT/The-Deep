-- Migration: Fix graves table structure and add RLS policies
-- Run this ENTIRE block as ONE query in your Supabase SQL Editor

-- Step 1: Ensure graves table has the correct columns
-- First, check if we need to add columns (using IF NOT EXISTS won't work for ALTER TABLE, so we'll use a DO block)

DO $$
BEGIN
    -- Add user_id column if it doesn't exist (in case table uses player_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'graves' AND column_name = 'user_id'
    ) THEN
        -- If player_id exists, we might need to migrate, but for now just add user_id
        ALTER TABLE graves ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- If there's existing data with player_id, you'd need to migrate it here
        -- For now, we'll just add the column
    END IF;

    -- Add items_json column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'graves' AND column_name = 'items_json'
    ) THEN
        ALTER TABLE graves ADD COLUMN items_json JSONB DEFAULT '[]';
        
        -- Migrate existing 'items' column to 'items_json' if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'graves' AND column_name = 'items'
        ) THEN
            UPDATE graves SET items_json = items WHERE items_json IS NULL OR items_json = '[]';
        END IF;
    END IF;

    -- Add gold_lost column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'graves' AND column_name = 'gold_lost'
    ) THEN
        ALTER TABLE graves ADD COLUMN gold_lost INTEGER DEFAULT 0;
    END IF;
END $$;

-- Step 2: Enable RLS on graves table (if not already enabled)
ALTER TABLE graves ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own graves" ON graves;
DROP POLICY IF EXISTS "Users can insert their own graves" ON graves;
DROP POLICY IF EXISTS "Users can delete their own graves" ON graves;
DROP POLICY IF EXISTS "Users can update their own graves" ON graves;

-- Step 4: Create RLS policies for graves table
-- Policy: Users can SELECT their own graves
CREATE POLICY "Users can view their own graves"
ON graves
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own graves
CREATE POLICY "Users can insert their own graves"
ON graves
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can DELETE their own graves
CREATE POLICY "Users can delete their own graves"
ON graves
FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Users can UPDATE their own graves (if needed for retrieval)
CREATE POLICY "Users can update their own graves"
ON graves
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 5: Create index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_graves_user_id ON graves(user_id);

