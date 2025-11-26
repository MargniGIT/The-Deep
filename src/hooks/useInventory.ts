import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useInventory(userId: string | null) {
  const [loading, setLoading] = useState(false);

  // Function to Equip an Item
  const equipItem = useCallback(async (itemId: number, targetSlot: string) => {
    if (!userId) return false;

    setLoading(true);
    try {
      console.log(`Attempting to equip Item ${itemId} into ${targetSlot}...`);

      // 1. Unequip ANYTHING currently in this slot for this user
      const { error: unequipError } = await supabase
        .from('inventory')
        .update({ is_equipped: false })
        .eq('user_id', userId)
        .eq('slot', targetSlot);

      if (unequipError) throw unequipError;

      // 2. Equip the NEW item
      const { error: equipError } = await supabase
        .from('inventory')
        .update({ is_equipped: true, slot: targetSlot })
        .eq('user_id', userId)
        .eq('id', itemId);

      if (equipError) throw equipError;

      console.log("Equip success!");
      return true;

    } catch (error: unknown) {
      console.error('Equip Failed:', (error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Function to Unequip
  const unequipItem = useCallback(async (itemId: number) => {
    if (!userId) return false;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ is_equipped: false })
        .eq('user_id', userId)
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error: unknown) {
      console.error('Unequip Failed:', (error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Function to Scrap Item
  const scrapItem = useCallback(async (itemId: number) => {
    if (!userId) return false;
    setLoading(true);
    try {
      // 1. Check if Scrap Metal item exists in DB
      const { data: scrapItemDef } = await supabase
        .from('items')
        .select('id')
        .eq('id', '1000')
        .single();

      if (!scrapItemDef) {
        alert("CRITICAL ERROR: 'Scrap Metal' item (ID 1000) is missing from the database.\nPlease run the 'setup_scrap.sql' script in your Supabase SQL Editor.");
        throw new Error("Scrap Metal item missing in DB.");
      }

      // 2. Delete the item
      const { error: deleteError } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 3. Add Scrap Metal (ID: 1000)
      const { error: insertError } = await supabase.from('inventory').insert({
        user_id: userId,
        item_id: '1000', // Using '1000' as string ID for Scrap Metal
        is_equipped: false,
      });

      if (insertError) throw insertError;

      return true;
    } catch (error: unknown) {
      console.error('Scrap Failed:', (error as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { equipItem, unequipItem, scrapItem, loading };
}




