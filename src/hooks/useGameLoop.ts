import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';
const MAX_LEVEL = 50;

// Helper function to calculate training cost
const getTrainingCost = (bought: number) => 100 * (bought + 1);

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

// --- AFFIX POOLS ---
const PREFIXES = [
  { name: "Glimmering", stats: { value: 5, precision: 1 } },
  { name: "Heavy", stats: { defense: 2, vigor: 1 } },
  { name: "Sharp", stats: { damage: 2, precision: 1 } },
  { name: "Ancient", stats: { aether: 2, value: 10 } },
  { name: "Rusty", stats: { damage: -1, value: -2 } }
];
const SUFFIXES = [
  { name: "of the Wolf", stats: { precision: 2, damage: 1 } },
  { name: "of the Bear", stats: { vigor: 3, defense: 1 } },
  { name: "of the Owl", stats: { aether: 3, precision: 1 } },
  { name: "of the Hawk", stats: { precision: 3 } },
  { name: "of Stone", stats: { defense: 3, vigor: 1 } }
];

function getAtmosphereLog(depth: number) {
  const pool = depth < 1000 ? SHALLOW_LOGS : DEEP_LOGS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function useGameLoop(
  userId: string | null,
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
    if (!userId) {
      console.error('No user ID found');
      return;
    }
    if (!player || player.stat_points <= 0) return;
    const newStats = {
      [statName]: (player[statName] || 0) + 1,
      stat_points: player.stat_points - 1,
      max_stamina: statName === 'vigor' ? player.max_stamina + 5 : player.max_stamina
    };
    const { error } = await supabase.from('profiles').update(newStats).eq('id', userId);
    if (!error) {
      onProfileUpdate({ ...player, ...newStats });
      addLog(`You increased your ${statName.toUpperCase()}!`);
    }
  }, [userId, player, onProfileUpdate, addLog]);

  const handleGoldUpgrade = useCallback(async (stat: 'vigor' | 'precision' | 'aether') => {
    if (!userId) {
      console.error('No user ID found');
      return;
    }
    if (!player) return;

    const statsBought = (player as any).stats_bought || 0;
    const cost = getTrainingCost(statsBought);
    const currentGold = player.gold || 0;

    if (currentGold < cost) {
      addLog(`Not enough gold! Need ${cost} gold.`);
      return;
    }

    // If vigor is upgraded, also increase max_stamina by 5 and refill health/energy
    const newMaxStamina = stat === 'vigor' ? (player.max_stamina || 0) + 5 : player.max_stamina;
    
    const newStats: Partial<PlayerProfile> & { stats_bought?: number } = {
      [stat]: (player[stat] || 0) + 1,
      gold: currentGold - cost,
      stats_bought: statsBought + 1,
      max_stamina: stat === 'vigor' ? newMaxStamina : player.max_stamina,
    };

    // Refill health/energy when vigor is upgraded
    if (stat === 'vigor') {
      newStats.vigor = newMaxStamina; // Refill health to new max
      newStats.current_stamina = newMaxStamina; // Refill energy to new max
    }

    const { error } = await supabase
      .from('profiles')
      .update(newStats)
      .eq('id', userId);

    if (!error) {
      onProfileUpdate({ ...player, ...newStats } as PlayerProfile);
      addLog(`You invested ${cost} gold to increase your ${stat.toUpperCase()}!`);
    } else {
      console.error('Error updating profile:', error);
      addLog('Failed to upgrade stat.');
    }
  }, [userId, player, onProfileUpdate, addLog]);

  const handleDescend = useCallback(async () => {
    if (!userId) {
      console.error('No user ID found');
      return;
    }
    if (!player || loading) return;

    setLoading(true);

    try {
      let newDepth = (player.depth || 0) + 1;
      let newStamina = player.current_stamina || 0;
      let newGold = player.gold || 0;
      let newVigor = player.vigor || 10;
      let newXP = player.xp || 0;
      let newLevel = player.level || 1;
      let newStatPoints = player.stat_points || 0;
      let logMessage = "";
      let exhaustionDamage = 0;

      // --- EXHAUSTION LOGIC ---
      // If you keep descending with no stamina, you take HP damage instead.
      if (newStamina <= 0) {
        exhaustionDamage = 2;
        newVigor = Math.max(0, newVigor - exhaustionDamage);
        onEffect('damage', exhaustionDamage);
        // Stamina stays at 0 when exhausted
      } else {
        newStamina = Math.max(0, newStamina - 1);
      }

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
          // --- AFFIX GENERATION (Only for weapons and armor) ---
          const shouldHaveAffixes = randomItem.type === 'weapon' || randomItem.type === 'armor';

          let fullName = randomItem.name;
          let combinedStats = randomItem.stats || {};
          if (shouldHaveAffixes) {
            const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
            const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
            // Merge Stats
            const baseStats = randomItem.stats || {};
            combinedStats = { ...baseStats };

            // Add prefix stats
            Object.entries(prefix.stats).forEach(([key, val]) => {
              if (val !== undefined) {
                combinedStats[key] = (combinedStats[key] || 0) + val;
              }
            });

            // Add suffix stats
            Object.entries(suffix.stats).forEach(([key, val]) => {
              if (val !== undefined) {
                combinedStats[key] = (combinedStats[key] || 0) + val;
              }
            });

            // Construct Name
            fullName = `${prefix.name} ${randomItem.name} ${suffix.name}`;
          }
          const { error } = await supabase.from('inventory').insert({
            user_id: userId,
            item_id: randomItem.id,
            is_equipped: false,
            slot: randomItem.valid_slot || null,
            name_override: shouldHaveAffixes ? fullName : null,
            stats_override: shouldHaveAffixes ? combinedStats : null
          });
          if (!error) {
            logMessage = `You found a ${fullName}!`;
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
          const { data: gear } = await supabase.from('inventory').select('*, item:items(*)').eq('user_id', userId).eq('is_equipped', true);
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

      // Prepend exhaustion message if applicable
      if (exhaustionDamage > 0) {
        const exhaustionText = `Pushing past exhaustion drains your life. (-${exhaustionDamage} HP)`;
        logMessage = logMessage ? `${exhaustionText} ${logMessage}` : exhaustionText;
      }

      // Level & Death Checks
      const xpNeeded = newLevel * 100;
      if (newLevel < MAX_LEVEL && newXP >= xpNeeded) {
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
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;

      addLog(logMessage);
      onProfileUpdate({ ...player, ...updates });

    } catch (err) { console.error(err); addLog("Something went wrong."); }
    finally { setLoading(false); }
  }, [userId, player, loading, addLog, onProfileUpdate, onEffect]);

  return { handleDescend, handleStatUpgrade, handleGoldUpgrade, logs, loading };
}