-- Migration: Add health columns to profiles table
-- Run this ENTIRE block as ONE query in your Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_health INTEGER DEFAULT 100;

-- Update existing profiles to have default health values (if any exist)
UPDATE profiles
SET 
  health = COALESCE(health, 100),
  max_health = COALESCE(max_health, 100)
WHERE health IS NULL OR max_health IS NULL;

