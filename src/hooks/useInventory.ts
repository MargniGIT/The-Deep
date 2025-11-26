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
      // 1. Get the item to calculate scrap value
      const { data: inventoryItem } = await supabase
        .from('inventory')
        .select('*, item:items(*)')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single();

      if (!inventoryItem) {
        throw new Error("Item not found in inventory.");
      }

      const item = inventoryItem.item;
      const quantity = inventoryItem.quantity || 1;
      const scrapValue = (item.scrap_value || item.value || 0) * quantity;

      if (scrapValue <= 0) {
        alert("This item has no scrap value.");
        return false;
      }

      // 2. Delete the item
      const { error: deleteError } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 3. Add Scrap Metal (ID: 1000) using RPC function for stacking
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('add_item_to_inventory', {
          p_user_id: userId,
          p_item_id: 1000,
          p_quantity: scrapValue
        });

      if (rpcError) throw rpcError;

      if (rpcResult && !rpcResult.success) {
        throw new Error(rpcResult.error || 'Failed to add scrap metal');
      }

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




