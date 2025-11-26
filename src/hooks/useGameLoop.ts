import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';

const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

// --- HORROR TEXT POOLS ---
const SHALLOW_LOGS = [
  "Water drips from the ceiling... plip... plip...",
  "You hear skittering claws in the distance.",
  "A cold draft chills your bones.",
  "The torchlight flickers violently.",
  "You step over a pile of old, dry bones.",
  "The air smells of rust and rot.",
  "Did something just move in the shadows?",
  "Your footsteps echo too loudly here.",
  "You feel like you are being watched.",
  "A distant chain rattles in the dark."
];

const DEEP_LOGS = [
  "The walls seem to be... breathing.",
  "You hear a voice whispering your name.",
  "The darkness presses against your chest.",
  "Gravity feels heavier here.",
  "You see a face in the rock, screaming silently.",
  "The silence here is deafening.",
  "Something massive is moving below you.",
  "You feel an overwhelming sense of dread.",
  "The air tastes metallic and wrong.",
  "A shadow passes directly through you."
];

function getAtmosphereLog(depth: number) {
  const pool = depth < 1000 ? SHALLOW_LOGS : DEEP_LOGS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function useGameLoop(
  player: PlayerProfile | null,
  onProfileUpdate: (newProfile: PlayerProfile) => void,
  onEffect: (type: 'damage' | 'gold' | 'xp' | 'item', value?: number) => void 
) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 50)); 
  }, []);

  const handleStatUpgrade = useCallback(async (statName: 'vigor' | 'precision' | 'aether') => {
    if (!player || player.stat_points <= 0) return;
    const newStats = {
      [statName]: (player[statName] || 0) + 1,
      stat_points: player.stat_points - 1,
      max_stamina: statName === 'vigor' ? player.max_stamina + 5 : player.max_stamina
    };
    const { error } = await supabase.from('profiles').update(newStats).eq('id', HARDCODED_USER_ID);
    if (!error) {
      onProfileUpdate({ ...player, ...newStats });
      addLog(`You increased your ${statName.toUpperCase()}!`);
    }
  }, [player, onProfileUpdate, addLog]);

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

      // --- REBALANCED LOGIC TREE ---
      
      // 1. ATMOSPHERE (0-40%) - The "Build Up"
      if (roll <= 40) {
        logMessage = getAtmosphereLog(newDepth);
      } 
      
      // 2. GOLD (41-70%) - The "Scavenge"
      else if (roll <= 70) {
        const goldFound = Math.floor(Math.random() * 10) + 5;
        newGold += goldFound;
        logMessage = `You found a vein of gold! (+${goldFound} Gold)`;
        onEffect('gold', goldFound);
      } 
      
      // 3. LOOT (71-85%) - The "Treasure"
      else if (roll <= 85) {
        const { data: validItems } = await supabase
          .from('items')
          .select('*')
          .lte('min_depth', newDepth)
          .gte('max_depth', newDepth)
          .limit(10); 

        const randomItem = validItems && validItems.length > 0
          ? validItems[Math.floor(Math.random() * validItems.length)]
          : null;

        if (randomItem) {
           const { error } = await supabase.from('inventory').insert({
             user_id: HARDCODED_USER_ID,
             item_id: randomItem.id,
             is_equipped: false,
             slot: randomItem.valid_slot || null
           });
           if (!error) {
             logMessage = `You found a ${randomItem.name}!`;
             onEffect('item');
           } else {
             logMessage = `You saw a ${randomItem.name}, but couldn't reach it.`;
           }
        } else {
            logMessage = "You found nothing but dust.";
        }
      } 
      
      // 4. COMBAT (86-100%) - Increased Danger (15% chance now)
      else {
        const { data: monsters } = await supabase.from('monsters').select('*')
          .lte('min_depth', newDepth)
          .gte('max_depth', newDepth)
          .limit(5);
          
        const monster = monsters?.length ? monsters[Math.floor(Math.random() * monsters.length)] : null;

        if (!monster) {
           newVigor = Math.max(0, newVigor - 2);
           logMessage = "You tripped on a rock! (-2 HP)";
           onEffect('damage', 2);
        } else {
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
             logMessage = `Defeated ${monster.name}! Took ${totalDmgTaken} dmg.`;
             onEffect('damage', totalDmgTaken);
             setTimeout(() => onEffect('gold', monster.gold_reward), 200);
             setTimeout(() => onEffect('xp', monster.xp_reward), 400);
           } else {
             logMessage = `The ${monster.name} killed you.`;
             onEffect('damage', 999);
           }
        }
      }

      // Level & Death Checks
      const xpNeeded = newLevel * 100;
      if (newXP >= xpNeeded) {
        newLevel++; newXP -= xpNeeded; newStatPoints += 3;
        newVigor = player.max_stamina; newStamina = player.max_stamina;
        logMessage += " LEVEL UP!";
        onEffect('xp', 0);
      }
      if (newVigor <= 0) {
        logMessage = "YOU DIED. Resetting depth.";
        newDepth = 0; newGold = 0; newStamina = player.max_stamina; newVigor = player.max_stamina;
      }

      const updates = { depth: newDepth, current_stamina: newStamina, gold: newGold, vigor: newVigor, xp: newXP, level: newLevel, stat_points: newStatPoints };
      const { error } = await supabase.from('profiles').update(updates).eq('id', HARDCODED_USER_ID);
      if (error) throw error;

      addLog(logMessage);
      onProfileUpdate({ ...player, ...updates });

    } catch (err) { console.error(err); addLog("Something went wrong."); } 
    finally { setLoading(false); }
  }, [player, loading, addLog, onProfileUpdate, onEffect]);

  return { handleDescend, handleStatUpgrade, logs, loading };
}