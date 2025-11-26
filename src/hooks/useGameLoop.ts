import { useState, useCallback, useEffect } from 'react';
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
  onEffect: (type: 'damage' | 'gold' | 'xp' | 'item' | 'ghost', value?: number) => void
) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [graveDepth, setGraveDepth] = useState<number | null>(null);
  const [canRetrieve, setCanRetrieve] = useState(false);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 50));
  }, []);

  // Helper function to check for ghost users at a given depth
  const checkForGhosts = useCallback(async (depth: number): Promise<void> => {
    if (!userId) return;
    
    // Only check for ghosts 15% of the time (rare occurrence)
    if (Math.random() > 0.15) return;
    
    try {
      const { data: ghostUsers } = await supabase
        .from('profiles')
        .select('username')
        .neq('id', userId) // Exclude current user
        .gte('depth', depth - 5)
        .lte('depth', depth + 5)
        .limit(1);

      if (ghostUsers && ghostUsers.length > 0) {
        const ghostUsername = ghostUsers[0].username || 'Unknown Delver';
        const ghostMessages = [
          `[GHOST] You see a footprint left by ${ghostUsername}.`,
          `[GHOST] The echo of ${ghostUsername} lingers here.`
        ];
        const ghostMessage = ghostMessages[Math.floor(Math.random() * ghostMessages.length)];
        addLog(ghostMessage);
        onEffect('ghost');
      }
    } catch (err) {
      // Silently fail ghost checks - don't interrupt gameplay
      console.error('Ghost check failed:', err);
    }
  }, [userId, addLog, onEffect]);

  // Fetch grave depth on load
  useEffect(() => {
    if (!userId) {
      setGraveDepth(null);
      setCanRetrieve(false);
      return;
    }

    const fetchGrave = async () => {
      const { data } = await supabase
        .from('graves')
        .select('depth')
        .eq('user_id', userId)
        .single();

      if (data) {
        setGraveDepth(data.depth);
      } else {
        setGraveDepth(null);
      }
      setCanRetrieve(false);
    };

    fetchGrave();
  }, [userId]);

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
      // SAFE VARIABLE INITIALIZATION: Trust the profile, don't default to 10
      let newDepth = (player.depth || 0) + 1;
      let newStamina = player.current_stamina || 0;
      let newGold = player.gold || 0;
      let newVigor = player.vigor; // Trust the profile value
      let newXP = player.xp || 0;
      let newLevel = player.level || 1;
      let newStatPoints = player.stat_points || 0;
      let logMessage = "";
      let exhaustionDamage = 0;
      let deathCause: 'combat' | 'exhaustion' | null = null; // Track death cause for debug logs
      let killedByMonster: string | null = null; // Track monster name for death logs
      
      // Track all-time best depth
      const newMaxDepth = Math.max(newDepth, player.max_depth || 0);

      // --- GRAVE DISCOVERY CHECK ---
      if (graveDepth !== null && newDepth === graveDepth) {
        addLog('[!] You see your own bleached bones ahead.');
        setCanRetrieve(true);
      }

      // --- GHOST CHECK ---
      await checkForGhosts(newDepth);

      // --- EXPLICIT STAMINA PUNISHMENT ---
      // If you keep descending with no stamina, you take HP damage instead.
      if (player.current_stamina <= 0) {
        exhaustionDamage = 10; // Explicit stamina punishment: 10 damage
        newVigor = Math.max(0, newVigor - exhaustionDamage);
        onEffect('damage', exhaustionDamage);
        addLog('[!] You collapse from exhaustion. (-10 HP)');
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
        // Check inventory limit before adding items
        const { count: currentInventoryCount } = await supabase
          .from('inventory')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const INVENTORY_LIMIT = 30;
        if ((currentInventoryCount || 0) >= INVENTORY_LIMIT) {
          logMessage = "Your inventory is full! You can't carry any more items.";
        } else {
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
          gear?.forEach((g: any) => { 
            const stats = g.stats_override || g.item?.stats || {};
            bonusAtk += stats.damage || 0; 
            bonusDef += stats.defense || 0; 
          });

          // Calculate player total stats safely
          const playerTotalAtk = (player.precision || 0) + bonusAtk;
          const playerTotalDef = (player.vigor || 0) + bonusDef;

          // SAFE COMBAT MATH: Prevent Infinity and division by zero
          // Crit multiplier (10% chance for 2x damage)
          const critRoll = Math.random();
          const critMultiplier = critRoll < 0.1 ? 2 : 1;
          
          // Clamp damage to monster: Never allow 0 or negative, prevent infinity
          const dmgToMonster = Math.max(1, Math.floor((playerTotalAtk - monster.defense) * critMultiplier));
          
          // Clamp damage to player: Never allow 0 or negative
          const dmgToPlayer = Math.max(1, monster.attack - playerTotalDef);
          
          // Calculate combat rounds safely
          const hitsToKill = Math.ceil(monster.hp / dmgToMonster);
          const totalDmgTaken = hitsToKill * dmgToPlayer;

          newVigor = Math.max(0, newVigor - totalDmgTaken);

          if (newVigor > 0) {
            newGold += monster.gold_reward;
            newXP += monster.xp_reward;
            const critText = critMultiplier > 1 ? ' [CRIT!]' : '';
            logMessage = `Defeated ${monster.name}!${critText} Took ${totalDmgTaken} dmg.`;
            onEffect('damage', totalDmgTaken);
            setTimeout(() => onEffect('gold', monster.gold_reward), 200);
            setTimeout(() => onEffect('xp', monster.xp_reward), 400);
          } else {
            // Mark combat death and store monster name
            deathCause = 'combat';
            killedByMonster = monster.name;
            logMessage = `YOU DIED fighting ${monster.name}.`;
            onEffect('damage', 999);
          }
        }
      }

      // Level & Death Checks
      const xpNeeded = newLevel * 100;
      if (newLevel < MAX_LEVEL && newXP >= xpNeeded) {
        newLevel++; newXP -= xpNeeded; newStatPoints += 3;
        newVigor = player.max_stamina; newStamina = player.max_stamina;
        logMessage += " LEVEL UP!";
        onEffect('xp', 0);
      }
      
      // Check for death from exhaustion (after all other damage)
      if (newVigor <= 0 && deathCause !== 'combat') {
        deathCause = 'exhaustion';
      }
      
      if (newVigor <= 0) {
        // --- DEATH LOGIC: Hardcore Corpse Retrieval ---
        const currentDepth = player.depth || 0;
        const currentGold = player.gold || 0;

        // Fetch ALL items (equipped AND unequipped)
        const { data: allItems } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', userId);

        // Serialize items to JSON, preserving item_id, is_equipped, stats_override, name_override
        const itemsJson = (allItems || []).map(item => ({
          item_id: item.item_id,
          is_equipped: item.is_equipped,
          stats_override: item.stats_override,
          name_override: item.name_override,
          slot: item.slot
        }));

        // Delete Old Grave: The 'Double Death' rule - if you die before retrieving, the old grave is lost forever
        const { error: deleteOldGraveError } = await supabase
          .from('graves')
          .delete()
          .eq('user_id', userId);

        if (deleteOldGraveError) {
          console.error('Failed to delete old grave:', deleteOldGraveError);
        }

        // Create New Grave
        const { error: graveError } = await supabase
          .from('graves')
          .insert({
            user_id: userId,
            depth: currentDepth,
            gold_lost: currentGold,
            items_json: itemsJson
          });

        if (graveError) {
          console.error('Failed to create grave:', graveError);
        }

        // Wipe player inventory
        const { error: deleteError } = await supabase
          .from('inventory')
          .delete()
          .eq('user_id', userId);

        if (deleteError) {
          console.error('Failed to delete inventory:', deleteError);
        }

        // Find Rusty Shiv by name
        const { data: rustyShiv } = await supabase
          .from('items')
          .select('id')
          .eq('name', 'Rusty Shiv')
          .single();

        // The Mercy Drop: Insert Rusty Shiv if found
        if (rustyShiv) {
          const { error: shivError } = await supabase
            .from('inventory')
            .insert({
              user_id: userId,
              item_id: rustyShiv.id,
              is_equipped: false
            });

          if (shivError) {
            console.error('Failed to insert Rusty Shiv:', shivError);
          }
        }

        // Wipe Player: Set gold to 0 and reset depth
        newDepth = 0;
        newGold = 0;
        newStamina = player.max_stamina;
        newVigor = player.max_stamina;
        
        // Log death message
        logMessage = `YOU DIED. Your gear lies at ${currentDepth}m.`;
        
        // Update grave depth state
        setGraveDepth(currentDepth);
        setCanRetrieve(false);
      }

      const updates = { depth: newDepth, max_depth: newMaxDepth, current_stamina: newStamina, gold: newGold, vigor: newVigor, xp: newXP, level: newLevel, stat_points: newStatPoints };
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;

      addLog(logMessage);
      onProfileUpdate({ ...player, ...updates });

    } catch (err) { console.error(err); addLog("Something went wrong."); }
    finally { setLoading(false); }
  }, [userId, player, loading, addLog, onProfileUpdate, onEffect, graveDepth, checkForGhosts]);

  const handleExplore = useCallback(async () => {
    if (!userId) {
      console.error('No user ID found');
      return;
    }
    if (!player || loading) return;

    setLoading(true);

    try {
      const currentDepth = player.depth || 0;
      
      // Calculate dynamic stamina cost
      const staminaCost = Math.max(1, Math.floor(currentDepth / 1000));
      
      // Check if player has enough stamina
      if ((player.current_stamina || 0) < staminaCost) {
        addLog(`Not enough stamina! Need ${staminaCost} stamina to explore.`);
        setLoading(false);
        return;
      }

      let newStamina = (player.current_stamina || 0) - staminaCost;
      let newGold = player.gold || 0;
      let newVigor = player.vigor;
      let newXP = player.xp || 0;
      let logMessage = "";

      // --- GHOST CHECK ---
      await checkForGhosts(currentDepth);

      const roll = Math.floor(Math.random() * 100) + 1;

      // Loot Table: 60% Materials, 20% Nothing, 20% Combat
      if (roll <= 60) {
        // Check inventory limit before adding items
        const { count: currentInventoryCount } = await supabase
          .from('inventory')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const INVENTORY_LIMIT = 30;
        if ((currentInventoryCount || 0) >= INVENTORY_LIMIT) {
          logMessage = "Your inventory is full! You can't carry any more items.";
        } else {
          // 60% chance: Find Materials (prioritize type='material')
          const { data: materialItems } = await supabase
            .from('items')
            .select('*')
            .eq('type', 'material')
            .lte('min_depth', currentDepth)
            .gte('max_depth', currentDepth)
            .limit(10);

          if (materialItems && materialItems.length > 0) {
            const randomMaterial = materialItems[Math.floor(Math.random() * materialItems.length)];
            const { error } = await supabase.from('inventory').insert({
              user_id: userId,
              item_id: randomMaterial.id,
              is_equipped: false,
              slot: randomMaterial.valid_slot || null
            });
            if (!error) {
              logMessage = `You found a ${randomMaterial.name}!`;
              onEffect('item');
            } else {
              logMessage = "You found something, but couldn't pick it up.";
            }
          } else {
            // Fallback: any item if no materials available
            const { data: fallbackItems } = await supabase
              .from('items')
              .select('*')
              .lte('min_depth', currentDepth)
              .gte('max_depth', currentDepth)
              .limit(10);
            
            if (fallbackItems && fallbackItems.length > 0) {
              const randomItem = fallbackItems[Math.floor(Math.random() * fallbackItems.length)];
              const { error } = await supabase.from('inventory').insert({
                user_id: userId,
                item_id: randomItem.id,
                is_equipped: false,
                slot: randomItem.valid_slot || null
              });
              if (!error) {
                logMessage = `You found a ${randomItem.name}!`;
                onEffect('item');
              } else {
                logMessage = "You found something, but couldn't pick it up.";
              }
            } else {
              logMessage = "You searched thoroughly but found nothing.";
            }
          }
        }
      } else if (roll <= 80) {
        // 20% chance: Nothing
        logMessage = "You explored the area but found nothing of value.";
      } else {
        // 20% chance: Combat
        const { data: monsters } = await supabase
          .from('monsters')
          .select('*')
          .lte('min_depth', currentDepth)
          .gte('max_depth', currentDepth)
          .limit(5);

        const monster = monsters?.length ? monsters[Math.floor(Math.random() * monsters.length)] : null;

        if (!monster) {
          newVigor = Math.max(0, newVigor - 2);
          logMessage = "You tripped on a rock! (-2 damage)";
          onEffect('damage', 2);
        } else {
          const { data: gear } = await supabase
            .from('inventory')
            .select('*, item:items(*)')
            .eq('user_id', userId)
            .eq('is_equipped', true);
          
          let bonusAtk = 0, bonusDef = 0;
          gear?.forEach((g: any) => { 
            const stats = g.stats_override || g.item?.stats || {};
            bonusAtk += stats.damage || 0; 
            bonusDef += stats.defense || 0; 
          });

          const playerTotalAtk = (player.precision || 0) + bonusAtk;
          const playerTotalDef = (player.vigor || 0) + bonusDef;

          const critRoll = Math.random();
          const critMultiplier = critRoll < 0.1 ? 2 : 1;
          
          const dmgToMonster = Math.max(1, Math.floor((playerTotalAtk - monster.defense) * critMultiplier));
          const dmgToPlayer = Math.max(1, monster.attack - playerTotalDef);
          
          const hitsToKill = Math.ceil(monster.hp / dmgToMonster);
          const totalDmgTaken = hitsToKill * dmgToPlayer;

          newVigor = Math.max(0, newVigor - totalDmgTaken);

          if (newVigor > 0) {
            newGold += monster.gold_reward;
            newXP += monster.xp_reward;
            const critText = critMultiplier > 1 ? ' [CRIT!]' : '';
            logMessage = `Defeated ${monster.name}!${critText} Took ${totalDmgTaken} damage.`;
            onEffect('damage', totalDmgTaken);
            setTimeout(() => onEffect('gold', monster.gold_reward), 200);
            setTimeout(() => onEffect('xp', monster.xp_reward), 400);
          } else {
            logMessage = `YOU DIED fighting ${monster.name}.`;
            onEffect('damage', 999);
            // Death handling would be similar to handleDescend, but simplified for explore
            newVigor = player.max_stamina;
            newStamina = player.max_stamina;
          }
        }
      }

      // Very low XP reward (1-2 XP) for exploration
      const exploreXP = Math.floor(Math.random() * 2) + 1;
      newXP += exploreXP;
      if (exploreXP > 0) {
        setTimeout(() => onEffect('xp', exploreXP), 600);
      }

      const updates = { 
        current_stamina: newStamina, 
        gold: newGold, 
        vigor: newVigor, 
        xp: newXP 
      };
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;

      addLog(logMessage);
      onProfileUpdate({ ...player, ...updates });

    } catch (err) { 
      console.error(err); 
      addLog("Something went wrong while exploring."); 
    }
    finally { 
      setLoading(false); 
    }
  }, [userId, player, loading, addLog, onProfileUpdate, onEffect, checkForGhosts]);

  return { handleDescend, handleExplore, handleStatUpgrade, handleGoldUpgrade, logs, loading, canRetrieve, setCanRetrieve, addLog, setGraveDepth };
}