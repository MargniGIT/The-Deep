import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';

const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

export function useGameLoop(
  player: PlayerProfile | null,
  onProfileUpdate: (newProfile: PlayerProfile) => void,
  onLogUpdate: (newLogs: string[]) => void 
) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 50)); 
  }, []);

  // --- NEW ACTION: UPGRADE STAT ---
  const handleStatUpgrade = useCallback(async (statName: 'vigor' | 'precision' | 'aether') => {
    if (!player || player.stat_points <= 0) return;

    // Optimistic Update
    const newStats = {
      [statName]: (player[statName] || 0) + 1,
      stat_points: player.stat_points - 1,
      // If upgrading Vigor, also boost max stamina slightly? Optional.
      max_stamina: statName === 'vigor' ? player.max_stamina + 5 : player.max_stamina
    };

    const { error } = await supabase
      .from('profiles')
      .update(newStats)
      .eq('id', HARDCODED_USER_ID);

    if (!error) {
      onProfileUpdate({ ...player, ...newStats });
      addLog(`You increased your ${statName.toUpperCase()}!`);
    }
  }, [player, onProfileUpdate, addLog]);

  // --- DESCEND ACTION ---
  const handleDescend = useCallback(async () => {
    if (!player || loading) return;
    if (player.current_stamina <= 0) {
      addLog("You are too exhausted to continue.");
      return;
    }

    setLoading(true);

    try {
      let newDepth = (player.depth || 0) + 1;
      let newStamina = player.current_stamina - 1;
      let newGold = player.gold || 0;
      let newVigor = player.vigor || 10;
      let newXP = player.xp || 0;
      let newLevel = player.level || 1;
      let newStatPoints = player.stat_points || 0;
      let logMessage = "";

      const roll = Math.floor(Math.random() * 100) + 1;

      // ... (Logic Trees same as before) ...
      if (roll <= 50) {
        logMessage = "The path is silent.";
      } 
      else if (roll <= 80) {
        const goldFound = Math.floor(Math.random() * 10) + 5;
        newGold += goldFound;
        logMessage = `You found a vein of gold! (+${goldFound} Gold)`;
      } 
      else if (roll <= 90) {
        // Loot Logic
        const { count } = await supabase.from('items').select('*', { count: 'exact', head: true });
        const randomIndex = Math.floor(Math.random() * (count || 1));
        const { data: randomItems } = await supabase.from('items').select('*').range(randomIndex, randomIndex); 
        const randomItem = randomItems?.[0];

        if (randomItem) {
           const { error } = await supabase.from('inventory').insert({
             user_id: HARDCODED_USER_ID,
             item_id: randomItem.id,
             is_equipped: false,
             slot: randomItem.valid_slot || null
           });
           logMessage = !error ? `You found a ${randomItem.name}!` : `You saw a ${randomItem.name}, but missed it.`;
        } else {
            logMessage = "Shadows play tricks on your eyes.";
        }
      } 
      else {
        // Combat Logic
        const { data: monsters } = await supabase.from('monsters').select('*')
          .lte('min_depth', newDepth).limit(5);
        const monster = monsters?.length ? monsters[Math.floor(Math.random() * monsters.length)] : null;

        if (!monster) {
           newVigor = Math.max(0, newVigor - 2);
           logMessage = "You tripped on a rock! (-2 HP)";
        } else {
           // Gear Stats
           const { data: gear } = await supabase.from('inventory').select('*, item:items(*)').eq('user_id', HARDCODED_USER_ID).eq('is_equipped', true);
           let bonusAtk = 0, bonusDef = 0;
           gear?.forEach((g: any) => { bonusAtk += g.item.stats?.damage || 0; bonusDef += g.item.stats?.defense || 0; });

           const totalAtk = (player.precision || 1) + bonusAtk;
           const totalDef = (player.vigor || 1) + bonusDef;
           
           const dmgToMonster = Math.max(1, totalAtk - monster.defense);
           const dmgToPlayer = Math.max(1, monster.attack - totalDef);
           const hitsToKill = Math.ceil(monster.hp / dmgToMonster);
           const totalDmgTaken = hitsToKill * dmgToPlayer;

           newVigor = Math.max(0, newVigor - totalDmgTaken);
           if (newVigor > 0) {
             newGold += monster.gold_reward;
             newXP += monster.xp_reward;
             logMessage = `Defeated ${monster.name}! Took ${totalDmgTaken} dmg. (+${monster.xp_reward} XP)`;
           } else {
             logMessage = `The ${monster.name} killed you.`;
           }
        }
      }

      // --- LEVEL UP CHECK ---
      const xpNeeded = newLevel * 100;
      if (newXP >= xpNeeded) {
        newLevel++;
        newXP -= xpNeeded;
        newStatPoints += 3; // Grant 3 points
        newVigor = player.max_stamina; // Heal on level up
        newStamina = player.max_stamina;
        logMessage += " LEVEL UP! (+3 Stat Points)";
      }

      // --- DEATH CHECK ---
      if (newVigor <= 0) {
        logMessage = "YOU DIED. Waking up in town...";
        newDepth = 0; 
        newGold = 0; 
        newStamina = player.max_stamina;
        newVigor = player.max_stamina;
      }

      const updates = { depth: newDepth, current_stamina: newStamina, gold: newGold, vigor: newVigor, xp: newXP, level: newLevel, stat_points: newStatPoints };
      
      const { error } = await supabase.from('profiles').update(updates).eq('id', HARDCODED_USER_ID);
      if (error) throw error;

      addLog(logMessage);
      onProfileUpdate({ ...player, ...updates });

    } catch (err) {
      console.error(err);
      addLog("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [player, loading, addLog, onProfileUpdate]);

  return { handleDescend, handleStatUpgrade, logs, loading };
}