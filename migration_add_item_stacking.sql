-- Migration: Add item stacking function
-- Run this ENTIRE block as ONE query in your Supabase SQL Editor
--
-- This function handles adding items to inventory with automatic stacking logic.
-- If an item is stackable and the user already has it, it updates the quantity.
-- Otherwise, it inserts a new inventory row.

CREATE OR REPLACE FUNCTION add_item_to_inventory(
  p_user_id UUID,
  p_item_id INTEGER,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stackable BOOLEAN;
  v_existing_inventory_id INTEGER;
  v_existing_quantity INTEGER;
  v_result JSONB;
BEGIN
  -- Check if item is stackable
  SELECT stackable INTO v_stackable
  FROM items
  WHERE id = p_item_id;
  
  -- If item not found, return error
  IF v_stackable IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Item not found'
    );
  END IF;
  
  -- If stackable, check if user already has this item
  IF v_stackable THEN
    SELECT id, quantity INTO v_existing_inventory_id, v_existing_quantity
    FROM inventory
    WHERE user_id = p_user_id
      AND item_id = p_item_id
      AND is_equipped = false  -- Only stack unequipped items
    LIMIT 1;
    
    -- If exists, update quantity
    IF v_existing_inventory_id IS NOT NULL THEN
      UPDATE inventory
      SET quantity = quantity + p_quantity
      WHERE id = v_existing_inventory_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', 'updated',
        'inventory_id', v_existing_inventory_id,
        'new_quantity', v_existing_quantity + p_quantity
      );
    END IF;
  END IF;
  
  -- If not stackable OR not exists, insert new row
  INSERT INTO inventory (user_id, item_id, quantity, is_equipped)
  VALUES (p_user_id, p_item_id, p_quantity, false)
  RETURNING id INTO v_existing_inventory_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'inserted',
    'inventory_id', v_existing_inventory_id,
    'new_quantity', p_quantity
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_item_to_inventory(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_item_to_inventory(UUID, INTEGER, INTEGER) TO anon;

