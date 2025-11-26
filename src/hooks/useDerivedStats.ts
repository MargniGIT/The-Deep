import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';

type DerivedStats = {
  attack: number;
  defense: number;
};

/**
 * Computes derived combat stats from the player profile + equipped gear.
 *
 * - Only hits the inventory table when needed (on mount, profile change, or inventory open/close)
 * - Uses the latest local `player` state so UI updates immediately after actions
 */
export function useDerivedStats(
  userId: string | null,
  player: PlayerProfile | null,
  isInventoryOpen: boolean
): DerivedStats {
  const [derived, setDerived] = useState<DerivedStats>({ attack: 0, defense: 0 });

  const recompute = useCallback(async () => {
    if (!userId || !player) {
      setDerived({ attack: 0, defense: 0 });
      return;
    }

    try {
      const { data: gear } = await supabase
        .from('inventory')
        .select('*, item:items(*)')
        .eq('user_id', userId)
        .eq('is_equipped', true);

      let bonusAttack = 0;
      let bonusDefense = 0;

      gear?.forEach((entry: any) => {
        bonusAttack += entry.item?.stats?.damage || 0;
        bonusDefense += entry.item?.stats?.defense || 0;
      });

      setDerived({
        attack: (player.precision || 0) + bonusAttack,
        defense: (player.vigor || 0) + bonusDefense,
      });
    } catch (err) {
      console.error('Failed to compute derived stats', err);
    }
  }, [userId, player]);

  useEffect(() => {
    // Re-run when player core stats change or when inventory opens/closes
    recompute();
  }, [recompute, isInventoryOpen]);

  return derived;
}



