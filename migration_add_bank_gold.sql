-- Migration: Add bank_gold column to profiles table
-- Run this ENTIRE block as ONE query in your Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bank_gold INTEGER DEFAULT 0;

-- Update existing profiles to have default bank_gold value (if any exist)
UPDATE profiles
SET bank_gold = COALESCE(bank_gold, 0)
WHERE bank_gold IS NULL;

