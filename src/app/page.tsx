'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useAudio } from '@/hooks/useAudio';
import StatsDisplay from '@/components/StatsDisplay';
import GameLog from '@/components/GameLog';
import Town from '@/components/Town';
import InventoryModal from '@/components/InventoryModal';
import CombatModal from '@/components/CombatModal';
import AdminPanel from '@/components/AdminPanel';
import BiomeBackground from '@/components/BiomeBackground';
import AchievementToast from '@/components/AchievementToast';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile, InventoryItem } from '@/types';
import { Shield, Sword, Volume2, VolumeX } from 'lucide-react';

type FloatingText = {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
};

// Helper function to get biome style based on depth (HUD-like styles for header)
function getBiomeStyle(depth: number): string {
  if (depth < 500) {
    // Default Industrial/Dark
    return 'bg-zinc-900/80 border-zinc-800';
  } else if (depth < 1500) {
    // Mossy/Damp
    return 'bg-emerald-950/80 border-emerald-500/30 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)]';
  } else if (depth < 3000) {
    // Crystal/Magical
    return 'bg-violet-950/80 border-violet-500/30 shadow-[0_10px_40px_-10px_rgba(139,92,246,0.5)]';
  } else {
    // The Void/Danger
    return 'bg-red-950/90 border-red-500/50 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)]';
  }
}

export default function Home() {
  const { playAmbience, playSfx, playHover, isMuted, toggleMute } = useAudio();
  const [userId, setUserId] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [derivedStats, setDerivedStats] = useState({ attack: 0, defense: 0 });
  
  const [isTownOpen, setIsTownOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const [damageFlash, setDamageFlash] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [retrieving, setRetrieving] = useState(false);
  const [bossInventory, setBossInventory] = useState<InventoryItem[]>([]);
  const [achievementNotification, setAchievementNotification] = useState<{ title: string; icon?: string; description: string } | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Authenticating...');

  // Mapping of achievement titles/descriptions to title IDs
  const achievementToTitleMap: Record<string, string> = {
    'Boss Slayer': 'slayer',
    'Deep Diver': 'deep_diver', // Note: Achievement is 500m, Title is 1000m - but we can still link them
  };

  // --- 1. UPDATED HANDLE EFFECT ---
  const handleEffect = useCallback(async (type: 'damage' | 'gold' | 'xp' | 'item' | 'ghost' | 'achievement', value?: number, achievementData?: { title: string; description: string }) => {
    if (type === 'damage') {
      setDamageFlash(true);
      setTimeout(() => setDamageFlash(false), 300);
    }

    if (type === 'achievement' && achievementData) {
      setAchievementNotification({
        title: achievementData.title,
        description: achievementData.description
      });
      // Auto-hide after 5 seconds
      setTimeout(() => {
        setAchievementNotification(null);
      }, 5000);
      
      // Check if achievement has a corresponding title and unlock it
      if (userId && achievementData.title && achievementToTitleMap[achievementData.title]) {
        const titleId = achievementToTitleMap[achievementData.title];
        try {
          // Check if title already exists
          const { data: existingTitle } = await supabase
            .from('user_titles')
            .select('title_id')
            .eq('user_id', userId)
            .eq('title_id', titleId)
            .maybeSingle();
          
          if (!existingTitle) {
            const { error } = await supabase
              .from('user_titles')
              .insert({ user_id: userId, title_id: titleId });
            
            if (!error) {
              console.log(`Title unlocked via achievement: ${titleId}`);
            }
          }
        } catch (err) {
          console.error('Error unlocking title from achievement:', err);
        }
      }
      
      return;
    }

    const id = Date.now() + Math.random();
    let text = '';
    let color = 'text-white';

    if (type === 'damage' && value) { text = `-${value}`; color = 'text-red-500 font-black text-2xl'; }
    if (type === 'gold' && value) { text = `+${value} G`; color = 'text-yellow-400 font-bold text-xl'; }
    if (type === 'xp' && value) { text = `+${value} XP`; color = 'text-blue-400 font-bold'; }
    if (type === 'item') { text = 'ITEM FOUND!'; color = 'text-purple-400 font-bold'; }
    // Ghost effect handled visually later, no floating text needed

    if (text) {
      setFloatingTexts(prev => [
        ...prev, 
        { 
          id, 
          text, 
          color, 
          // SPREAD LOGIC:
          x: (Math.random() - 0.5) * 300, 
          y: (Math.random() - 0.5) * 200 
        }
      ]);
      
      setTimeout(() => {
        setFloatingTexts(prev => prev.filter(t => t.id !== id));
      }, 1500);
    }
  }, []);

  const { handleDescend, handleExplore, handleStatUpgrade, handleGoldUpgrade, handleBankTransaction, logs, loading: loopLoading, canRetrieve, setCanRetrieve, addLog, setGraveDepth, activeBoss, resolveBossFight, spawnBoss } = useGameLoop(
    userId,
    player, 
    (p) => setPlayer(p), 
    handleEffect 
  );

  // Load authenticated user ID (if any)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          // No active auth session; leave userId as null
          setUserId(null);
          return;
        }
        setUserId(data.user.id);
      } catch (error) {
        console.error('Error fetching auth user:', error);
        setUserId(null);
      }
    };

    loadUser();
  }, []);

  // Load existing anonymous ID from localStorage (if any)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('deep_anon_user_id');
    if (stored && !userId) {
      setUserId(stored);
    }
  }, [userId]);

  // Anonymous "login" for local testing – generates a random per-browser ID
  const handleAnonLogin = useCallback(() => {
    if (typeof window === 'undefined') return;

    const existing = window.localStorage.getItem('deep_anon_user_id');
    if (existing) {
      setUserId(existing);
      return;
    }

    const newId =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `anon-${Math.random().toString(36).slice(2)}-${Date.now()}`;

    window.localStorage.setItem('deep_anon_user_id', newId);
    setUserId(newId);
  }, []);

  const loadPlayerAndStats = useCallback(async (currentUserId: string) => {
    setLoadingStatus('Authenticating...');
    
    // Try up to 5 times with delays (reduced from 15 since we'll manually create after 2 retries)
    const maxRetries = 5;
    const baseDelay = 500;
    const manualFallbackThreshold = 2; // After 2 retries (~1 second), use manual fallback
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Update loading status based on retry count
        if (i === 0) {
          setLoadingStatus('Waking up Hamsters...');
        } else if (i === 1) {
          setLoadingStatus('Generating World...');
        } else if (i >= 2) {
          setLoadingStatus('Creating Profile...');
        }

        // 1. Try to fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .single();

        // Handle 406 errors specifically (Not Acceptable - usually a header/format issue)
        if (profileError) {
          const errorCode = (profileError as any).code;
          const errorStatus = (profileError as any).status || (profileError as any).statusCode;
          
          // If it's a 406 error, log it but continue retrying (might be transient)
          if (errorStatus === 406 || errorCode === '406' || (profileError as any).message?.includes('406')) {
            console.warn(`HTTP 406 error on retry ${i + 1}/${maxRetries}. This may be a transient issue.`);
            // Wait a bit longer for 406 errors before retrying
            await new Promise(resolve => setTimeout(resolve, baseDelay * 2));
            continue;
          }
          
          // If it's a "not found" error (PGRST116), check if we should use manual fallback
          if (errorCode === 'PGRST116' || errorStatus === 404) {
            // If we've retried more than threshold times, use manual fallback
            if (i >= manualFallbackThreshold) {
              console.log(`Profile not found after ${i + 1} retries. Using manual fallback...`);
              setLoadingStatus('Creating Profile...');
              
              // Manual insert with ON CONFLICT handling
              try {
                const { data: newProfile, error: createError } = await supabase
                  .from('profiles')
                  .insert({
                    id: currentUserId,
                    username: `Diver-${currentUserId.slice(0, 8)}`,
                    depth: 0,
                    gold: 50,
                    vigor: 0,
                    precision: 0,
                    aether: 0,
                    current_stamina: 100,
                    max_stamina: 100,
                    health: 100,
                    max_health: 100,
                    xp: 0,
                    level: 1,
                    stat_points: 0,
                    stats_bought: 0
                  })
                  .select()
                  .single();

                // Handle success or conflict (409 = conflict, profile was created by trigger)
                if (newProfile && !createError) {
                  console.log("Profile created manually");
                  // Fetch gear and set player
                  const { data: gear } = await supabase
                    .from('inventory')
                    .select('*, item:items(*)')
                    .eq('user_id', currentUserId)
                    .eq('is_equipped', true);

                  let bonusAttack = 0, bonusDefense = 0;
                  gear?.forEach((entry: any) => {
                    bonusAttack += (entry.item.stats?.damage || 0);
                    bonusDefense += (entry.item.stats?.defense || 0);
                  });

                  setPlayer(newProfile as PlayerProfile);
                  setDerivedStats({
                    attack: (newProfile.precision || 0) + bonusAttack,
                    defense: (newProfile.vigor || 0) + bonusDefense,
                  });
                  return; // SUCCESS
                } else if (createError) {
                  // Check if it's a conflict error (409) - means trigger created it
                  const createErrorStatus = (createError as any).status || (createError as any).statusCode;
                  const createErrorCode = (createError as any).code;
                  
                  if (createErrorStatus === 409 || createErrorCode === '23505' || (createError as any).message?.includes('duplicate') || (createError as any).message?.includes('conflict')) {
                    console.log("Profile was created by trigger (conflict detected). Fetching...");
                    // Profile was created by trigger, fetch it immediately
                    const { data: fetchedProfile, error: fetchError } = await supabase
                      .from('profiles')
                      .select('*')
                      .eq('id', currentUserId)
                      .single();
                    
                    if (fetchedProfile && !fetchError) {
                      // Fetch gear and set player
                      const { data: gear } = await supabase
                        .from('inventory')
                        .select('*, item:items(*)')
                        .eq('user_id', currentUserId)
                        .eq('is_equipped', true);

                      let bonusAttack = 0, bonusDefense = 0;
                      gear?.forEach((entry: any) => {
                        bonusAttack += (entry.item.stats?.damage || 0);
                        bonusDefense += (entry.item.stats?.defense || 0);
                      });

                      setPlayer(fetchedProfile as PlayerProfile);
                      setDerivedStats({
                        attack: (fetchedProfile.precision || 0) + bonusAttack,
                        defense: (fetchedProfile.vigor || 0) + bonusDefense,
                      });
                      return; // SUCCESS
                    }
                  }
                  
                  // If not a conflict, log and continue to retry
                  console.warn("Manual insert failed (non-conflict):", createError);
                }
              } catch (manualError) {
                console.error("Error in manual fallback:", manualError);
                // Continue to retry loop
              }
            }
            
            // Continue retrying if we haven't hit threshold yet
            const delay = baseDelay * (1 + i * 0.2);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // For other errors, log and continue
          console.error(`Profile fetch error on retry ${i + 1}/${maxRetries}:`, profileError);
          const delay = baseDelay * (1 + i * 0.2);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // 2. If we found it, Great! Load stats and exit.
        if (profile) {
          setLoadingStatus('Loading Profile...');
          
          // Fetch Gear
          const { data: gear } = await supabase
            .from('inventory')
            .select('*, item:items(*)')
            .eq('user_id', currentUserId)
            .eq('is_equipped', true);

          // Calc Stats
          let bonusAttack = 0, bonusDefense = 0;
          gear?.forEach((entry: any) => {
            bonusAttack += (entry.item.stats?.damage || 0);
            bonusDefense += (entry.item.stats?.defense || 0);
          });

          setPlayer(profile as PlayerProfile);
          setDerivedStats({
            attack: (profile.precision || 0) + bonusAttack,
            defense: (profile.vigor || 0) + bonusDefense,
          });
          return; // SUCCESS - Stop looping
        }

        // 3. If not found yet, wait with exponential backoff (longer delays for later retries)
        const delay = baseDelay * (1 + i * 0.2); // 500ms, 600ms, 700ms, etc.
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error(`Retry ${i + 1}/${maxRetries}...`, error);
        // Continue retrying even on error
        const delay = baseDelay * (1 + i * 0.2);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Final fallback: If profile still doesn't exist after all retries, try to create it one more time
    console.warn("Profile not found after all retries. Final attempt to create profile...");
    setLoadingStatus('Finalizing Profile...');
    try {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: currentUserId,
          username: `Diver-${currentUserId.slice(0, 8)}`,
          depth: 0,
          gold: 50,
          vigor: 0,
          precision: 0,
          aether: 0,
          current_stamina: 100,
          max_stamina: 100,
          health: 100,
          max_health: 100,
          xp: 0,
          level: 1,
          stat_points: 0,
          stats_bought: 0
        })
        .select()
        .single();

      if (newProfile && !createError) {
        console.log("Profile created successfully (final fallback)");
        setPlayer(newProfile as PlayerProfile);
        setDerivedStats({
          attack: newProfile.precision || 0,
          defense: newProfile.vigor || 0,
        });
        return;
      } else if (createError) {
        // If insert fails (e.g., profile was created between retries), try one more fetch
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .single();
        
        if (profile && !fetchError) {
          setPlayer(profile as PlayerProfile);
          setDerivedStats({
            attack: (profile.precision || 0),
            defense: (profile.vigor || 0),
          });
          return;
        }
        
        console.error("Failed to create profile:", createError);
      }
    } catch (error) {
      console.error("Error creating profile:", error);
    }
    
    console.error("Profile load failed after all attempts. Please refresh the page.");
  }, []);

  // Wrapper function to handle loading states
  const loadPlayerAndStatsWithState = useCallback(async (currentUserId: string) => {
    setIsLoading(true);
    setLoadingError(null);
    try {
      await loadPlayerAndStats(currentUserId);
    } catch (error) {
      console.error('Error loading player:', error);
      setLoadingError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadPlayerAndStats]);

  useEffect(() => { 
    if (userId) {
      loadPlayerAndStatsWithState(userId);
    }
  }, [userId, loadPlayerAndStatsWithState]);
  useEffect(() => { 
    if (userId && !isInventoryOpen) {
      loadPlayerAndStatsWithState(userId);
    }
  }, [isInventoryOpen, userId, loadPlayerAndStatsWithState]);

  // Start/update ambience based on player depth
  useEffect(() => {
    if (player && player.depth !== undefined) {
      playAmbience(player.depth);
    }
  }, [player?.depth, playAmbience]);

  // Load inventory when boss encounter starts
  useEffect(() => {
    const loadBossInventory = async () => {
      if (!userId || !activeBoss) return;
      
      const { data, error } = await supabase
        .from('inventory')
        .select('*, item:items(*)')
        .eq('user_id', userId)
        .order('is_equipped', { ascending: false });
      
      if (!error && data) {
        setBossInventory(data as InventoryItem[]);
      }
    };
    
    loadBossInventory();
  }, [userId, activeBoss]);

  // Handle boss victory
  const handleBossVictory = useCallback(async (finalHp: number) => {
    if (!player || !activeBoss) return;
    
    await resolveBossFight('victory', finalHp);
    
    // Reload player stats
    if (userId) {
      loadPlayerAndStats(userId);
    }
  }, [player, activeBoss, resolveBossFight, userId, loadPlayerAndStats]);

  // Handle boss defeat
  const handleBossDefeat = useCallback(async () => {
    if (!player || !activeBoss) return;
    
    await resolveBossFight('defeat', 0);
    
    // Reload player stats
    if (userId) {
      loadPlayerAndStats(userId);
    }
  }, [player, activeBoss, resolveBossFight, userId, loadPlayerAndStats]);

  // Handle grave retrieval
  const handleRetrieveGrave = useCallback(async () => {
    console.log('handleRetrieveGrave called', { userId, canRetrieve, retrieving });
    if (!userId || !canRetrieve || retrieving) {
      console.log('Early return:', { userId: !!userId, canRetrieve, retrieving });
      return;
    }

    // Immediately disable button to prevent duplicate clicks
    setRetrieving(true);
    setCanRetrieve(false);
    console.log('Starting grave retrieval...');
    
    // Safety timeout to ensure state resets even if something hangs
    const timeoutId = setTimeout(() => {
      console.warn('Retrieval taking too long, forcing state reset');
      setRetrieving(false);
    }, 15000); // 15 second timeout
    
    try {
      // Fetch the grave data
      const { data: grave, error: graveError } = await supabase
        .from('graves')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (graveError) {
        console.error('Failed to fetch grave:', graveError);
        console.error('Grave error details:', {
          message: graveError.message,
          code: graveError.code,
          details: graveError.details,
          hint: graveError.hint
        });
        addLog('Failed to retrieve your grave. It may have been lost to the depths.');
        return;
      }

      if (!grave) {
        console.error('No grave found for user:', userId);
        // Double-check by querying all graves for this user (for debugging)
        const { data: allGraves, error: debugError } = await supabase
          .from('graves')
          .select('*')
          .eq('user_id', userId);
        console.log('Debug: All graves for user:', allGraves);
        if (debugError) {
          console.error('Debug query error:', debugError);
        }
        addLog('No grave found. If you just died, the grave may not have been created. Check console for errors.');
        return;
      }

      console.log('Grave found:', grave);

      // Check current inventory count
      const { count: currentCount, error: invError } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (invError) {
        console.error('Failed to check inventory:', invError);
      }

      const INVENTORY_LIMIT = 60; // Default inventory limit
      const itemsJson = grave.items_json || [];
      const availableSlots = INVENTORY_LIMIT - (currentCount || 0);

      if (availableSlots <= 0) {
        addLog('Your inventory is full! Make space before retrieving.');
        setCanRetrieve(true); // Re-enable button
        return;
      }

      // Delete the grave FIRST to prevent duplication (atomic operation)
      const { error: deleteError } = await supabase
        .from('graves')
        .delete()
        .eq('id', grave.id);

      if (deleteError) {
        console.error('Failed to delete grave:', deleteError);
        addLog('Failed to secure your grave. Retrieval cancelled.');
        setCanRetrieve(true); // Re-enable button
        return;
      }

      console.log('Grave deleted, preventing duplication');

      // Add gold_lost to player gold
      const newGold = (player?.gold || 0) + (grave.gold_lost || 0);
      const { error: goldError } = await supabase
        .from('profiles')
        .update({ gold: newGold })
        .eq('id', userId);

      if (goldError) {
        console.error('Failed to update gold:', goldError);
      } else {
        setPlayer({ ...player!, gold: newGold });
      }

      // Re-hydrate items: Only restore what fits in inventory
      const itemsToRestore = itemsJson.slice(0, availableSlots);
      const itemsSkipped = itemsJson.length - itemsToRestore.length;
      
      console.log(`Restoring ${itemsToRestore.length} items from grave (${itemsSkipped} skipped due to inventory limit)`);
      
      for (const item of itemsToRestore) {
        // Extract only the fields we need (ignore id, user_id, created_at from saved row)
        const { error: insertError } = await supabase
          .from('inventory')
          .insert({
            user_id: userId,
            item_id: item.item_id,
            is_equipped: item.is_equipped ?? false,
            slot: item.slot ?? null,
            name_override: item.name_override ?? null,
            stats_override: item.stats_override ?? null
          });

        if (insertError) {
          console.error('Failed to restore item:', insertError, item);
        } else {
          console.log('Restored item:', item.item_id, item.is_equipped ? '(equipped)' : '(unequipped)');
        }
      }
      
      console.log('Items restoration complete');

      // Log success message
      if (itemsSkipped > 0) {
        addLog(`You reclaimed your legacy. (${itemsSkipped} items lost - inventory full)`);
      } else {
        addLog('You reclaimed your legacy.');
      }
      
      setGraveDepth(null); // Clear grave depth after retrieval
      
      // Reload player stats (don't await to avoid blocking)
      if (userId) {
        loadPlayerAndStats(userId).catch(err => {
          console.error('Error reloading stats:', err);
        });
      }
    } catch (error) {
      console.error('Error retrieving grave:', error);
      addLog('Something went wrong while retrieving your grave.');
      setCanRetrieve(true); // Re-enable button on error
    } finally {
      // Clear timeout and always reset retrieving state
      clearTimeout(timeoutId);
      setRetrieving(false);
      console.log('Retrieval complete, resetting state');
    }
  }, [userId, canRetrieve, player, setCanRetrieve, loadPlayerAndStats, addLog, setGraveDepth, retrieving]);

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-mono max-w-md mx-auto border-x border-zinc-800 relative overflow-hidden">
        <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-bold text-zinc-100">The Deep</h1>
          <p className="text-sm text-zinc-400 max-w-xs">
            No account connected. For development, you can create an anonymous diver profile on this browser.
          </p>
          <button
            onClick={handleAnonLogin}
            className="px-4 py-2 rounded bg-zinc-100 text-black font-bold hover:bg-white transition-colors"
          >
            Log in anonymously
          </button>
          <p className="text-xs text-zinc-500 max-w-xs">
            This generates a random ID stored in your browser only. Each browser/profile will get its own separate save.
          </p>
        </div>
      </main>
    );
  }
  
  if (!player) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
        <div className="text-center space-y-4">
          <div className="text-xl font-bold">Loading Abyss...</div>
          <div className="text-sm text-zinc-600 animate-pulse">
            {loadingStatus}
          </div>
          {loadingError && (
            <div className="space-y-2">
              <div className="text-sm text-red-400">{loadingError}</div>
              <button
                onClick={() => loadPlayerAndStatsWithState(userId)}
                className="px-4 py-2 rounded bg-zinc-800 text-zinc-100 font-bold hover:bg-zinc-700 transition-colors text-sm"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const biomeStyle = getBiomeStyle(player.depth || 0);

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-mono max-w-md mx-auto border-x border-zinc-800 relative overflow-hidden">
      <BiomeBackground depth={player.depth || 0} />
      
      <div className={`pointer-events-none absolute inset-0 z-50 ${damageFlash ? 'animate-damage' : ''}`} />

      {/* Achievement Toast */}
      <AchievementToast notification={achievementNotification} />

      {/* --- 2. UPDATED JSX RENDER --- */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden flex justify-center items-center">
        {floatingTexts.map(ft => (
          <div 
            key={ft.id} 
            className="absolute"
            style={{ transform: `translate(${ft.x}px, ${ft.y}px)` }}
          >
            <span className={`block floating-number ${ft.color} whitespace-nowrap`}>
              {ft.text}
            </span>
          </div>
        ))}
      </div>

      <header className={`relative z-50 p-4 border-b transition-all duration-[3000ms] ease-in-out ${biomeStyle}`}>
        <StatsDisplay
          profile={player}
          onUpgrade={handleStatUpgrade}
        />
        <div className="flex gap-4 mt-3 text-sm">
          <div className="flex items-center gap-2 text-red-400"><Sword size={16} /><span className="font-bold">{derivedStats.attack} ATK</span></div>
          <div className="flex items-center gap-2 text-blue-400"><Shield size={16} /><span className="font-bold">{derivedStats.defense} DEF</span></div>
        </div>
      </header>

      <section className="relative z-10 flex-1 overflow-hidden">
        <GameLog 
          logs={logs} 
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onPlaySfx={playSfx}
          onPlayHover={playHover}
        />
        {/* Floating Retrieve Souls Button */}
        {canRetrieve && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center z-50 pointer-events-auto px-4">
            <button
              onClick={handleRetrieveGrave}
              disabled={retrieving}
              className="bg-emerald-900/80 hover:bg-emerald-800/80 text-emerald-200 px-4 py-2 rounded font-bold text-xs border border-emerald-400/50 transition-all hover:border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 w-full max-w-xs backdrop-blur-sm"
            >
              {retrieving ? 'RETRIEVING...' : 'RETRIEVE SOULS'}
            </button>
          </div>
        )}
      </section>

      {isTownOpen && (
        <Town
          userId={userId}
          player={player}
          onClose={() => setIsTownOpen(false)}
          onRest={(u) => setPlayer({ ...player, ...u })}
          onGoldUpgrade={handleGoldUpgrade}
          onBankTransaction={handleBankTransaction}
        />
      )}

      <InventoryModal
        userId={userId}
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
      />

      {activeBoss && player && (
        <CombatModal
          player={player}
          monster={activeBoss}
          onVictory={handleBossVictory}
          onDefeat={handleBossDefeat}
          inventory={bossInventory}
        />
      )}

      <footer className="relative z-50 p-4 border-t border-zinc-800 bg-zinc-900 grid grid-cols-3 gap-2">
        <button 
          onClick={() => {
            playSfx('ui_click');
            setIsTownOpen(!isTownOpen);
            setIsInventoryOpen(false); // Close inventory when opening camp/town
          }}
          onMouseEnter={() => playHover()}
          className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-yellow-500 transition-colors"
        >
          {player.depth > 0 ? 'CAMP' : 'TOWN'}
        </button>
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => { playSfx('ui_click'); handleDescend(); }} 
            onMouseEnter={() => playHover()}
            disabled={loopLoading || isTownOpen || isInventoryOpen} 
            className="bg-zinc-100 hover:bg-white text-black p-2 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transform duration-75 text-sm"
          >
            {loopLoading ? '...' : 'DESCEND'}
          </button>
          <button 
            onClick={() => { playSfx('ui_click'); handleExplore(); }}
            onMouseEnter={() => playHover()}
            disabled={loopLoading || isTownOpen || isInventoryOpen || (player.current_stamina || 0) < Math.max(1, Math.floor((player.depth || 0) / 1000))} 
            className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded font-bold text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transform duration-75 text-sm"
          >
            {loopLoading ? '...' : `EXPLORE (-${Math.max(1, Math.floor((player.depth || 0) / 1000))})`}
          </button>
        </div>
        <button 
          onClick={() => {
            playSfx('ui_click');
            setIsInventoryOpen(true);
            setIsTownOpen(false); // Close camp/town when opening inventory
          }}
          onMouseEnter={() => playHover()}
          className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-blue-400 transition-colors"
        >
          BAG
        </button>
      </footer>

      {/* Spawn Boss Button (admin only) */}
      {!activeBoss && player.is_admin && (
        <div className="fixed top-20 right-4 z-50 pointer-events-auto">
          <button
            onClick={() => { playSfx('ui_click'); spawnBoss(); }}
            onMouseEnter={() => playHover()}
            disabled={loopLoading || isTownOpen || isInventoryOpen}
            className="bg-red-600/90 hover:bg-red-600 text-white px-3 py-2 rounded font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-2 border-red-700/50"
          >
            SPAWN BOSS
          </button>
        </div>
      )}

      <AdminPanel player={player} onUpdate={(updates) => setPlayer({ ...player, ...updates })} />
    </main>
  );
}