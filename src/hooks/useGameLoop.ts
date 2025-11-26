import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';
const MAX_LEVEL = 50;

// Helper function to calculate training cost
const getTrainingCost = (bought: number) => 100 * (bought + 1);

// --- SET BONUSES ---
const SET_BONUSES: Record<string, Record<number, Record<string, number>>> = {
  "Warden's Steel": {
    2: { vigor: 10 },
    3: { defense: 10 },
    4: { aether: 20 }
  }
};

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

// Helper function to get rarity tag for log messages
function getRarityTag(item: any): string {
  if (!item) return '[JUNK]';
  
  // Check if item is part of a set
  if (item.set_name) {
    return '[SET]';
  }
  
  // Check rarity
  const rarity = item.rarity?.toLowerCase() || 'common';
  switch (rarity) {
    case 'legendary':
      return '[LEGENDARY]';
    case 'epic':
    case 'rare':
      return '[RARE]';
    case 'uncommon':
      return '[UNCOMMON]';
    default:
      return '[JUNK]';
  }
}

export function useGameLoop(
  userId: string | null,
  player: PlayerProfile | null,
  onProfileUpdate: (newProfile: PlayerProfile) => void,
  onEffect: (type: 'damage' | 'gold' | 'xp' | 'item' | 'ghost' | 'achievement', value?: number, achievementData?: { title: string; description: string }) => void
) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [graveDepth, setGraveDepth] = useState<number | null>(null);
  const [canRetrieve, setCanRetrieve] = useState(false);
  const [activeBoss, setActiveBoss] = useState<any | null>(null);
  const [achievements, setAchievements] = useState<Set<string>>(new Set());
  const achievementsLoadedRef = useRef(false);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 50));
  }, []);

  // Load achievements on mount
  useEffect(() => {
    if (!userId || achievementsLoadedRef.current) return;
    
    const loadAchievements = async () => {
      try {
        const { data, error } = await supabase
          .from('user_achievements')
          .select('achievement_id')
          .eq('user_id', userId);
        
        if (!error && data) {
          const achievementSet = new Set(data.map(a => a.achievement_id));
          setAchievements(achievementSet);
          achievementsLoadedRef.current = true;
        }
      } catch (err) {
        console.error('Error loading achievements:', err);
      }
    };
    
    loadAchievements();
  }, [userId]);

  // Helper function to unlock achievements
  const unlockAchievement = useCallback(async (id: string, title: string, desc: string) => {
    if (!userId) return;
    
    // Check if already unlocked
    if (achievements.has(id)) return;
    
    try {
      // Insert into database
      const { error } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: id
        });
      
      if (!error) {
        // Update local state
        setAchievements(prev => new Set([...prev, id]));
        // Trigger achievement callback
        onEffect('achievement', undefined, { title, description: desc });
      } else {
        console.error('Error unlocking achievement:', error);
      }
    } catch (err) {
      console.error('Error unlocking achievement:', err);
    }
  }, [userId, achievements, onEffect]);

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
      const { data, error } = await supabase
        .from('graves')
        .select('depth')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        // Silently handle errors - don't interrupt gameplay
        console.error('Error fetching grave:', error);
        setGraveDepth(null);
      } else if (data) {
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

  const handleBankTransaction = useCallback(async (amount: number) => {
    if (!userId) {
      console.error('No user ID found');
      return;
    }
    if (!player) return;

    const currentGold = player.gold || 0;
    const currentBankGold = player.bank_gold || 0;

    // Positive amount = Deposit
    if (amount > 0) {
      if (currentGold < amount) {
        addLog(`Not enough gold! You have ${currentGold} gold.`);
        return;
      }

      const newGold = currentGold - amount;
      const newBankGold = currentBankGold + amount;

      const { error } = await supabase
        .from('profiles')
        .update({ gold: newGold, bank_gold: newBankGold })
        .eq('id', userId);

      if (!error) {
        onProfileUpdate({ ...player, gold: newGold, bank_gold: newBankGold });
        addLog(`Deposited ${amount} Gold.`);
      } else {
        console.error('Error updating profile:', error);
        addLog('Failed to deposit gold.');
      }
    }
    // Negative amount = Withdraw
    else if (amount < 0) {
      const withdrawAmount = Math.abs(amount);
      if (currentBankGold < withdrawAmount) {
        addLog(`Not enough gold in vault! You have ${currentBankGold} gold.`);
        return;
      }

      const newGold = currentGold + withdrawAmount;
      const newBankGold = currentBankGold - withdrawAmount;

      const { error } = await supabase
        .from('profiles')
        .update({ gold: newGold, bank_gold: newBankGold })
        .eq('id', userId);

      if (!error) {
        onProfileUpdate({ ...player, gold: newGold, bank_gold: newBankGold });
        addLog(`Withdrew ${withdrawAmount} Gold.`);
      } else {
        console.error('Error updating profile:', error);
        addLog('Failed to withdraw gold.');
      }
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
      // Use health if available, otherwise fall back to vigor, then max_health, then max_stamina
      let currentHealth = player.health ?? player.vigor ?? player.max_health ?? player.max_stamina ?? 100;
      let maxHealth = player.max_health ?? player.max_stamina ?? 100;
      let newHealth = currentHealth;
      let newVigor = player.vigor; // Keep vigor as stat, but also track health separately
      let newXP = player.xp || 0;
      let newLevel = player.level || 1;
      let newStatPoints = player.stat_points || 0;
      let logMessage = "";
      let exhaustionDamage = 0;
      let deathCause: 'combat' | 'exhaustion' | null = null; // Track death cause for debug logs
      let killedByMonster: string | null = null; // Track monster name for death logs
      
      // Track all-time best depth
      const newMaxDepth = Math.max(newDepth, player.max_depth || 0);

      // Achievement: Deep Diver (reach depth 500)
      if (newDepth >= 500) {
        unlockAchievement('deep_diver', 'Deep Diver', 'Reached a depth of 500 meters');
      }

      // --- AETHER GOLD MULTIPLIER ---
      const goldMult = 1 + ((player.aether || 0) * 0.05); // 5% bonus per Aether point

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
        newHealth = Math.max(0, newHealth - exhaustionDamage);
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
        const baseGold = Math.floor(Math.random() * 10) + 5;
        const goldFound = Math.floor(baseGold * goldMult);
        const bonus = goldFound - baseGold;
        newGold += goldFound;
        if (bonus > 0) {
          logMessage = `You found a vein of gold! (+${goldFound} G [Bonus +${bonus}])`;
        } else {
          logMessage = `You found a vein of gold! (+${goldFound} Gold)`;
        }
        onEffect('gold', goldFound);
      }

      // 3. SCAVENGE (71-85%) - Junk and Materials
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
          // Fetch items where type = 'junk' or type = 'material'
          const { data: validItems } = await supabase
            .from('items')
            .select('*')
            .lte('min_depth', newDepth)
            .gte('max_depth', newDepth)
            .or('type.eq.junk,type.eq.material')
            .limit(10);

          const randomItem = validItems && validItems.length > 0
            ? validItems[Math.floor(Math.random() * validItems.length)]
            : null;

          if (randomItem) {
            const { error } = await supabase.from('inventory').insert({
              user_id: userId,
              item_id: randomItem.id,
              is_equipped: false,
              slot: randomItem.valid_slot || null
            });
            if (!error) {
              const rarityTag = getRarityTag(randomItem);
              logMessage = `${rarityTag} You scavenged some debris. Found: ${randomItem.name}`;
              onEffect('item');
            } else {
              logMessage = "You saw something, but couldn't reach it.";
            }
          } else {
            logMessage = "You scavenged some debris.";
          }
        }
      }

      // 4. TREASURE (86-90%) - Weapons, Armor, Accessories
      else if (roll <= 90) {
        // Check inventory limit before adding items
        const { count: currentInventoryCount } = await supabase
          .from('inventory')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const INVENTORY_LIMIT = 30;
        if ((currentInventoryCount || 0) >= INVENTORY_LIMIT) {
          logMessage = "Your inventory is full! You can't carry any more items.";
        } else {
          // Fetch items where type = 'weapon' | 'armor' | 'accessory'
          const { data: validItems } = await supabase
            .from('items')
            .select('*')
            .lte('min_depth', newDepth)
            .gte('max_depth', newDepth)
            .or('type.eq.weapon,type.eq.armor,type.eq.accessory')
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
              const rarityTag = getRarityTag(randomItem);
              logMessage = `${rarityTag} A treasure reveals itself! Found: ${fullName}`;
              onEffect('item');
            } else {
              logMessage = `You saw a ${randomItem.name}, but couldn't reach it.`;
            }
          } else {
            logMessage = "A treasure reveals itself!";
          }
        }
      }

      // 5. COMBAT (91-100%) - Increased Danger (10% chance now)
      else {
        const { data: monsters } = await supabase.from('monsters').select('*')
          .lte('min_depth', newDepth)
          .gte('max_depth', newDepth)
          .limit(5);

        const monster = monsters?.length ? monsters[Math.floor(Math.random() * monsters.length)] : null;

        if (!monster) {
          newHealth = Math.max(0, newHealth - 2);
          logMessage = "You tripped on a rock! (-2 HP)";
          onEffect('damage', 2);
        } else {
          // --- BOSS CHECK ---
          if (monster.is_boss) {
            // Do NOT auto-resolve boss fights
            setActiveBoss(monster);
            logMessage = `A ${monster.name} blocks your path!`;
            setLoading(false);
            return; // Exit early, combat will be handled by CombatModal
          }

          // Regular monster combat (auto-resolve)
          const { data: gear } = await supabase.from('inventory').select('*, item:items(*)').eq('user_id', userId).eq('is_equipped', true);
          let bonusAtk = 0, bonusDef = 0;
          gear?.forEach((g: any) => { 
            const stats = g.stats_override || g.item?.stats || {};
            bonusAtk += stats.damage || 0; 
            bonusDef += stats.defense || 0; 
          });

          // --- SET BONUSES ---
          // Count items by set_name
          const setCounts: Record<string, number> = {};
          gear?.forEach((g: any) => {
            const setName = g.item?.set_name;
            if (setName) {
              setCounts[setName] = (setCounts[setName] || 0) + 1;
            }
          });

          // Apply set bonuses
          let setBonusVigor = 0;
          let setBonusDef = 0;
          let setBonusAether = 0;
          Object.entries(setCounts).forEach(([setName, count]) => {
            const setBonus = SET_BONUSES[setName];
            if (setBonus) {
              // Find the highest bonus tier that applies (2, 3, or 4 pieces)
              const applicableTiers = Object.keys(setBonus)
                .map(Number)
                .filter(tier => count >= tier)
                .sort((a, b) => b - a); // Sort descending to get highest tier
              
              if (applicableTiers.length > 0) {
                const highestTier = applicableTiers[0];
                const bonuses = setBonus[highestTier];
                if (bonuses.vigor) setBonusVigor += bonuses.vigor;
                if (bonuses.defense) setBonusDef += bonuses.defense;
                if (bonuses.aether) setBonusAether += bonuses.aether;
              }
            }
          });

          // Calculate player total stats safely (including set bonuses)
          const playerTotalAtk = (player.precision || 0) + bonusAtk;
          // Defense should only come from equipment, not from vigor (health)
          const playerTotalDef = bonusDef + setBonusDef;
          // Apply vigor bonus to max_stamina (for health calculations)
          // Note: setBonusAether is applied but doesn't affect combat directly (only gold multiplier)
          const effectiveMaxStamina = (player.max_stamina || 0) + setBonusVigor;

          // SAFE COMBAT MATH: Prevent Infinity and division by zero
          // Crit multiplier (10% chance for 2x damage)
          const critRoll = Math.random();
          const critMultiplier = critRoll < 0.1 ? 2 : 1;
          
          // Clamp damage to monster: Never allow 0 or negative, prevent infinity
          const dmgToMonster = Math.max(1, Math.floor((playerTotalAtk - monster.defense) * critMultiplier));
          
          // Clamp damage to player: Never allow 0 or negative
          // Ensure minimum 1 damage is always taken
          const dmgToPlayer = Math.max(1, monster.attack - playerTotalDef);
          
          // Calculate combat rounds safely
          const hitsToKill = Math.ceil(monster.hp / dmgToMonster);
          const totalDmgTaken = hitsToKill * dmgToPlayer;

          newHealth = Math.max(0, newHealth - totalDmgTaken);

          if (newHealth > 0) {
            const baseGoldReward = monster.gold_reward;
            const goldReward = Math.floor(baseGoldReward * goldMult);
            const bonus = goldReward - baseGoldReward;
            newGold += goldReward;
            newXP += monster.xp_reward;
            const critText = critMultiplier > 1 ? ' [CRIT!]' : '';
            const bonusText = bonus > 0 ? ` [Bonus +${bonus} G]` : '';
            logMessage = `Defeated ${monster.name}!${critText} Took ${totalDmgTaken} dmg.`;
            onEffect('damage', totalDmgTaken);
            setTimeout(() => onEffect('gold', goldReward), 200);
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
        newHealth = maxHealth; newStamina = player.max_stamina;
        logMessage += " LEVEL UP!";
        onEffect('xp', 0);
        
        // Achievement: Seasoned Veteran (reach level 10)
        if (newLevel >= 10) {
          unlockAchievement('seasoned_veteran', 'Seasoned Veteran', 'Reached level 10');
        }
      }
      
      // Check for death from exhaustion (after all other damage)
      if (newHealth <= 0 && deathCause !== 'combat') {
        deathCause = 'exhaustion';
      }
      
      if (newHealth <= 0) {
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
        // Ensure all values are properly defined
        const safeItemsJson = Array.isArray(itemsJson) ? itemsJson : [];
        const safeDepth = currentDepth ?? 0;
        const safeGold = currentGold ?? 0;

        // Verify profile exists before creating grave (database trigger should have created it)
        // Just check - don't try to create (that would cause 409 Conflict)
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (profileCheckError && (profileCheckError as any).code !== 'PGRST116') {
          console.error('Error checking profile:', profileCheckError);
          addLog('Failed to verify profile. Grave creation skipped.');
        } else if (!existingProfile) {
          // Profile doesn't exist - this shouldn't happen if DB trigger is working
          console.error('Profile does not exist for user. Database trigger may have failed.');
          addLog('Profile not found. Grave creation skipped. Please refresh the page.');
          // Skip grave creation if profile doesn't exist
        } else {
          // Profile exists - proceed with grave creation
          const graveData = {
            user_id: userId,
            depth: safeDepth,
            gold_lost: safeGold,
            items_json: safeItemsJson
          };

          // Validate data before insert
          if (!userId || safeDepth === undefined || safeGold === undefined) {
            console.error('Invalid grave data:', { userId, depth: safeDepth, gold: safeGold, itemsCount: safeItemsJson.length });
            addLog('Failed to create grave: Invalid data.');
          } else {
          const { error: graveError, data: graveDataResult } = await supabase
            .from('graves')
            .insert(graveData)
            .select();

          if (graveError) {
            // Better error logging - Supabase errors have specific properties
            const errorMessage = graveError.message || 'Unknown error';
            const errorCode = graveError.code || 'NO_CODE';
            const errorDetails = graveError.details || null;
            const errorHint = graveError.hint || null;
            
            console.error('Failed to create grave:');
            console.error('  Message:', errorMessage);
            console.error('  Code:', errorCode);
            console.error('  Details:', errorDetails);
            console.error('  Hint:', errorHint);
            console.error('  Full error:', graveError);
            console.error('  Grave data attempted:', {
              user_id: graveData.user_id,
              depth: graveData.depth,
              gold_lost: graveData.gold_lost,
              items_count: graveData.items_json.length
            });
            
            // Provide helpful error message based on error code
            if (errorCode === '42501') {
              addLog('Failed to create grave: Database security policy error. Please contact admin.');
              console.error('RLS Policy Error: The graves table needs Row-Level Security policies. Run migration_fix_graves.sql in Supabase SQL Editor.');
            } else if (errorCode === '23503') {
              // Foreign key constraint violation
              addLog('Failed to create grave: User profile not found. Please ensure you are logged in.');
              console.error('Foreign Key Error: The user_id does not exist in the profiles table. This may indicate the profile was not created properly.');
              console.error('Run migration_fix_graves.sql to remove the foreign key constraint if using anonymous users.');
            } else {
              addLog(`Failed to create grave: ${errorMessage}. Your items may be lost.`);
            }
          } else if (graveDataResult && graveDataResult.length > 0) {
            console.log('Grave created successfully:', graveDataResult);
            // Update grave depth state immediately after successful creation
            setGraveDepth(safeDepth);
            // Verify the grave exists by fetching it
            const { data: verifyGrave, error: verifyError } = await supabase
              .from('graves')
              .select('depth')
              .eq('user_id', userId)
              .maybeSingle();
            if (verifyError) {
              console.error('Warning: Grave created but verification failed:', verifyError);
            } else if (!verifyGrave) {
              console.error('Warning: Grave created but not found on verification');
            } else {
              console.log('Grave verified at depth:', verifyGrave.depth);
            }
          } else {
            console.error('Grave creation returned no data:', graveDataResult);
            addLog('Failed to create grave: No data returned. Your items may be lost.');
          }
          }
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
        newHealth = maxHealth;
        
        // Log death message
        logMessage = `YOU DIED. Your gear lies at ${currentDepth}m.`;
        
        // Note: grave depth state is set immediately after successful grave creation above
        // Only set canRetrieve to false here (will be set to true when player reaches grave depth)
        setCanRetrieve(false);
      }

      const updates = { depth: newDepth, max_depth: newMaxDepth, current_stamina: newStamina, gold: newGold, health: newHealth, max_health: maxHealth, vigor: newVigor, xp: newXP, level: newLevel, stat_points: newStatPoints };
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;

      // Achievement: Hoarder (accumulate 1000 gold)
      if (newGold >= 1000) {
        unlockAchievement('hoarder', 'Hoarder', 'Accumulated 1000 gold');
      }

      addLog(logMessage);
      onProfileUpdate({ ...player, ...updates });

    } catch (err) { console.error(err); addLog("Something went wrong."); }
    finally { setLoading(false); }
  }, [userId, player, loading, addLog, onProfileUpdate, onEffect, graveDepth, checkForGhosts, unlockAchievement]);

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
      // Use health if available, otherwise fall back to vigor, then max_health, then max_stamina
      let currentHealth = player.health ?? player.vigor ?? player.max_health ?? player.max_stamina ?? 100;
      let maxHealth = player.max_health ?? player.max_stamina ?? 100;
      let newHealth = currentHealth;
      let newVigor = player.vigor; // Keep vigor as stat
      let newXP = player.xp || 0;
      let logMessage = "";

      // --- AETHER GOLD MULTIPLIER ---
      const goldMult = 1 + ((player.aether || 0) * 0.05); // 5% bonus per Aether point

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
          newHealth = Math.max(0, newHealth - 2);
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

          // --- SET BONUSES ---
          // Count items by set_name
          const setCounts: Record<string, number> = {};
          gear?.forEach((g: any) => {
            const setName = g.item?.set_name;
            if (setName) {
              setCounts[setName] = (setCounts[setName] || 0) + 1;
            }
          });

          // Apply set bonuses
          let setBonusVigor = 0;
          let setBonusDef = 0;
          let setBonusAether = 0;
          Object.entries(setCounts).forEach(([setName, count]) => {
            const setBonus = SET_BONUSES[setName];
            if (setBonus) {
              // Find the highest bonus tier that applies (2, 3, or 4 pieces)
              const applicableTiers = Object.keys(setBonus)
                .map(Number)
                .filter(tier => count >= tier)
                .sort((a, b) => b - a); // Sort descending to get highest tier
              
              if (applicableTiers.length > 0) {
                const highestTier = applicableTiers[0];
                const bonuses = setBonus[highestTier];
                if (bonuses.vigor) setBonusVigor += bonuses.vigor;
                if (bonuses.defense) setBonusDef += bonuses.defense;
                if (bonuses.aether) setBonusAether += bonuses.aether;
              }
            }
          });

          const playerTotalAtk = (player.precision || 0) + bonusAtk;
          // Defense should only come from equipment, not from vigor (health)
          const playerTotalDef = bonusDef + setBonusDef;
          // Note: setBonusVigor and setBonusAether are calculated but not directly used in explore combat

          const critRoll = Math.random();
          const critMultiplier = critRoll < 0.1 ? 2 : 1;
          
          const dmgToMonster = Math.max(1, Math.floor((playerTotalAtk - monster.defense) * critMultiplier));
          // Ensure minimum 1 damage is always taken
          const dmgToPlayer = Math.max(1, monster.attack - playerTotalDef);
          
          const hitsToKill = Math.ceil(monster.hp / dmgToMonster);
          const totalDmgTaken = hitsToKill * dmgToPlayer;

          newHealth = Math.max(0, newHealth - totalDmgTaken);

          if (newHealth > 0) {
            const baseGoldReward = monster.gold_reward;
            const goldReward = Math.floor(baseGoldReward * goldMult);
            const bonus = goldReward - baseGoldReward;
            newGold += goldReward;
            newXP += monster.xp_reward;
            const critText = critMultiplier > 1 ? ' [CRIT!]' : '';
            const bonusText = bonus > 0 ? ` [Bonus +${bonus} G]` : '';
            logMessage = `Defeated ${monster.name}!${critText} Took ${totalDmgTaken} damage.`;
            onEffect('damage', totalDmgTaken);
            setTimeout(() => onEffect('gold', goldReward), 200);
            setTimeout(() => onEffect('xp', monster.xp_reward), 400);
          } else {
            logMessage = `YOU DIED fighting ${monster.name}.`;
            onEffect('damage', 999);
            // Death handling would be similar to handleDescend, but simplified for explore
            newHealth = maxHealth;
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
        health: newHealth,
        max_health: maxHealth,
        vigor: newVigor, 
        xp: newXP 
      };
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;

      // Achievement: Hoarder (accumulate 1000 gold)
      if (newGold >= 1000) {
        unlockAchievement('hoarder', 'Hoarder', 'Accumulated 1000 gold');
      }

      addLog(logMessage);
      onProfileUpdate({ ...player, ...updates });

    } catch (err) { 
      console.error(err); 
      addLog("Something went wrong while exploring."); 
    }
    finally { 
      setLoading(false); 
    }
  }, [userId, player, loading, addLog, onProfileUpdate, onEffect, checkForGhosts, unlockAchievement]);

  // Resolve boss fight (called from CombatModal)
  const resolveBossFight = useCallback(async (result: 'victory' | 'defeat', finalPlayerHp: number) => {
    if (!userId || !player || !activeBoss) return;

    setLoading(true);
    try {
      const goldMult = 1 + ((player.aether || 0) * 0.05);
      
      if (result === 'victory') {
        const baseGoldReward = activeBoss.gold_reward;
        const goldReward = Math.floor(baseGoldReward * goldMult);
        const xpReward = activeBoss.xp_reward;
        
        const updates = {
          gold: (player.gold || 0) + goldReward,
          xp: (player.xp || 0) + xpReward,
          health: finalPlayerHp
        };
        
        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (!error) {
          onProfileUpdate({ ...player, ...updates });
          addLog(`Boss Defeated! +${goldReward} Gold, +${xpReward} XP`);
          onEffect('gold', goldReward);
          onEffect('xp', xpReward);
          
          // Achievement: Boss Slayer (defeat a boss)
          unlockAchievement('boss_slayer', 'Boss Slayer', 'Defeated your first boss');
          
          // Rat King guaranteed drop
          if (activeBoss.name === 'The Rat King') {
            // Find Rat Hide Vest by name
            const { data: ratHideVest } = await supabase
              .from('items')
              .select('*')
              .eq('name', 'Rat Hide Vest')
              .single();
            
            if (ratHideVest) {
              // Check inventory limit
              const { count: currentInventoryCount } = await supabase
                .from('inventory')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
              
              const INVENTORY_LIMIT = 30;
              if ((currentInventoryCount || 0) < INVENTORY_LIMIT) {
                const { error: insertError } = await supabase
                  .from('inventory')
                  .insert({
                    user_id: userId,
                    item_id: ratHideVest.id,
                    is_equipped: false,
                    slot: ratHideVest.valid_slot
                  });
                
                if (!insertError) {
                  addLog('The King drops his vestment! [SET ITEM]');
                  onEffect('item');
                }
              } else {
                addLog('The King drops his vestment! [SET ITEM] (Inventory Full)');
              }
            }
          }
        }
      } else {
        // Defeat - trigger death logic
        const currentDepth = player.depth || 0;
        const currentGold = player.gold || 0;

        // Fetch ALL items (equipped AND unequipped)
        const { data: allItems } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', userId);

        // Serialize items to JSON
        const itemsJson = (allItems || []).map(item => ({
          item_id: item.item_id,
          is_equipped: item.is_equipped,
          stats_override: item.stats_override,
          name_override: item.name_override,
          slot: item.slot
        }));

        // Delete Old Grave
        await supabase.from('graves').delete().eq('user_id', userId);

        // Create New Grave
        const safeItemsJson = Array.isArray(itemsJson) ? itemsJson : [];
        const safeDepth = currentDepth ?? 0;
        const safeGold = currentGold ?? 0;

        const graveData = {
          user_id: userId,
          depth: safeDepth,
          gold_lost: safeGold,
          items_json: safeItemsJson
        };

        await supabase.from('graves').insert(graveData);

        // Wipe inventory
        await supabase.from('inventory').delete().eq('user_id', userId);

        // Find Rusty Shiv
        const { data: rustyShiv } = await supabase
          .from('items')
          .select('id')
          .eq('name', 'Rusty Shiv')
          .single();

        if (rustyShiv) {
          await supabase.from('inventory').insert({
            user_id: userId,
            item_id: rustyShiv.id,
            is_equipped: false
          });
        }

        // Reset player
        const maxHealth = player.max_health ?? player.max_stamina ?? 100;
        const updates = {
          depth: 0,
          gold: 0,
          current_stamina: player.max_stamina,
          health: maxHealth
        };

        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (!error) {
          onProfileUpdate({ ...player, ...updates });
          addLog(`YOU DIED. Your gear lies at ${currentDepth}m.`);
        }
      }
    } catch (err) {
      console.error('Error resolving boss fight:', err);
      addLog('Something went wrong resolving the boss fight.');
    } finally {
      setActiveBoss(null);
      setLoading(false);
    }
  }, [userId, player, activeBoss, onProfileUpdate, addLog, onEffect, unlockAchievement]);

  return { 
    handleDescend, 
    handleExplore, 
    handleStatUpgrade, 
    handleGoldUpgrade, 
    handleBankTransaction, 
    logs, 
    loading, 
    canRetrieve, 
    setCanRetrieve, 
    addLog, 
    setGraveDepth,
    activeBoss,
    resolveBossFight
  };
}