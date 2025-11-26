import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// The ID we are pretending to be
const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

export function useInventory() {
  const [loading, setLoading] = useState(false);

  // Function to Equip an Item
  const equipItem = useCallback(async (itemId: number, targetSlot: string) => {
    setLoading(true);
    try {
      console.log(`Attempting to equip Item ${itemId} into ${targetSlot}...`);

      // 1. Unequip ANYTHING currently in this slot for this user
      // (This ensures we don't have 2 helmets on)
      const { error: unequipError } = await supabase
        .from('inventory')
        .update({ is_equipped: false })
        .eq('user_id', HARDCODED_USER_ID)
        .eq('slot', targetSlot);

      if (unequipError) throw unequipError;

      // 2. Equip the NEW item
      const { error: equipError } = await supabase
        .from('inventory')
        .update({ is_equipped: true, slot: targetSlot })
        .eq('user_id', HARDCODED_USER_ID)
        .eq('id', itemId);

      if (equipError) throw equipError;

      console.log("Equip success!");
      return true;

    } catch (error: any) {
      console.error('Equip Failed:', error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to Unequip
  const unequipItem = useCallback(async (itemId: number) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ is_equipped: false })
        .eq('user_id', HARDCODED_USER_ID)
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Unequip Failed:', error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { equipItem, unequipItem, loading };
}