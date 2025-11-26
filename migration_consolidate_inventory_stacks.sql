-- Migration: Consolidate existing inventory items into stacks
-- Run this ENTIRE block as ONE query in your Supabase SQL Editor
--
-- This script will:
-- 1. Find all duplicate stackable items in inventory (same user_id, same item_id, not equipped, no affixes)
-- 2. Merge them into a single row with the sum of quantities
-- 3. Delete the duplicate rows
--
-- NOTE: Items with name_override or stats_override (affixed items) are NOT merged as they are unique

-- Step 1: Ensure all inventory rows have quantity set (default to 1 if NULL)
UPDATE inventory
SET quantity = 1
WHERE quantity IS NULL;

-- Step 2: Consolidate stackable items using a DO block for proper transaction handling
DO $$
DECLARE
  v_user_id UUID;
  v_item_id INTEGER;
  v_total_quantity INTEGER;
  v_keep_id INTEGER;
  v_count INTEGER;
BEGIN
  -- Process each group of duplicates
  FOR v_user_id, v_item_id IN
    SELECT DISTINCT i.user_id, i.item_id
    FROM inventory i
    INNER JOIN items it ON it.id = i.item_id
    WHERE i.is_equipped = false
      AND it.stackable = true
      AND (i.name_override IS NULL AND i.stats_override IS NULL)  -- No affixes
    GROUP BY i.user_id, i.item_id
    HAVING COUNT(*) > 1  -- Only process if there are duplicates
  LOOP
    -- Get the ID to keep (minimum ID) and total quantity for this group
    SELECT 
      MIN(id),
      SUM(COALESCE(quantity, 1))
    INTO v_keep_id, v_total_quantity
    FROM inventory
    WHERE user_id = v_user_id
      AND item_id = v_item_id
      AND is_equipped = false
      AND name_override IS NULL
      AND stats_override IS NULL;
    
    -- Get count of rows to merge
    SELECT COUNT(*)
    INTO v_count
    FROM inventory
    WHERE user_id = v_user_id
      AND item_id = v_item_id
      AND is_equipped = false
      AND name_override IS NULL
      AND stats_override IS NULL;
    
    -- Only process if there are duplicates
    IF v_count > 1 THEN
      -- Update the kept row with total quantity
      UPDATE inventory
      SET quantity = v_total_quantity
      WHERE id = v_keep_id;
      
      -- Delete all other duplicate rows
      DELETE FROM inventory
      WHERE user_id = v_user_id
        AND item_id = v_item_id
        AND is_equipped = false
        AND name_override IS NULL
        AND stats_override IS NULL
        AND id != v_keep_id;
      
      RAISE NOTICE 'Consolidated item % for user %: merged % rows into quantity %', 
        v_item_id, v_user_id, v_count, v_total_quantity;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Inventory consolidation complete!';
END $$;

