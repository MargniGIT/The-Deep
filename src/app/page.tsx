'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import StatsDisplay from '@/components/StatsDisplay';
import GameLog from '@/components/GameLog';
import Town from '@/components/Town';
import InventoryModal from '@/components/InventoryModal';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';
import { Shield, Sword } from 'lucide-react';

type FloatingText = {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
};

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [derivedStats, setDerivedStats] = useState({ attack: 0, defense: 0 });
  
  const [isTownOpen, setIsTownOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const [damageFlash, setDamageFlash] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [retrieving, setRetrieving] = useState(false);

  // --- 1. UPDATED HANDLE EFFECT ---
  const handleEffect = useCallback((type: 'damage' | 'gold' | 'xp' | 'item', value?: number) => {
    if (type === 'damage') {
      setDamageFlash(true);
      setTimeout(() => setDamageFlash(false), 300);
    }

    const id = Date.now() + Math.random();
    let text = '';
    let color = 'text-white';

    if (type === 'damage' && value) { text = `-${value}`; color = 'text-red-500 font-black text-2xl'; }
    if (type === 'gold' && value) { text = `+${value} G`; color = 'text-yellow-400 font-bold text-xl'; }
    if (type === 'xp' && value) { text = `+${value} XP`; color = 'text-blue-400 font-bold'; }
    if (type === 'item') { text = 'ITEM FOUND!'; color = 'text-purple-400 font-bold'; }

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

  const { handleDescend, handleStatUpgrade, handleGoldUpgrade, logs, loading: loopLoading, canRetrieve, setCanRetrieve, addLog, setGraveDepth } = useGameLoop(
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

  const loadPlayerAndStats = useCallback(async () => {
    // If userId hasn't been loaded yet (or no user is logged in), just skip.
    if (!userId) {
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      let finalProfile = profile;

      // If no profile exists yet for this user, create one with sane defaults
      if (error) {
        // PGRST116: Results contain 0 rows (no profile yet)
        if ((error as any).code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              username: `Diver-${userId.slice(0, 8)}`,
              depth: 0,
              gold: 0,
              vigor: 5,
              precision: 5,
              aether: 5,
              current_stamina: 20,
              max_stamina: 20,
              xp: 0,
              level: 1,
              stat_points: 0,
              health: 100,
              max_health: 100,
            })
            .select('*')
            .single();

          if (insertError || !newProfile) {
            // In dev, avoid triggering Next.js error overlay for recoverable issues.
            console.warn('Failed to create profile for user', insertError || newProfile);
            return;
          }

          finalProfile = newProfile as PlayerProfile;
        } else {
          console.error('Error loading profile:', error);
          return;
        }
      }

      const { data: gear } = await supabase
        .from('inventory')
        .select('*, item:items(*)')
        .eq('user_id', userId)
        .eq('is_equipped', true);

      let bonusAttack = 0,
        bonusDefense = 0;
      gear?.forEach((entry: any) => {
        bonusAttack += (entry.item.stats?.damage || 0);
        bonusDefense += (entry.item.stats?.defense || 0);
      });

      setPlayer(finalProfile as PlayerProfile);
      setDerivedStats({
        attack: ((finalProfile as PlayerProfile).precision || 0) + bonusAttack,
        defense: ((finalProfile as PlayerProfile).vigor || 0) + bonusDefense,
      });
    } catch (error) {
      console.error(error);
    }
  }, [userId]);

  useEffect(() => { loadPlayerAndStats(); }, [loadPlayerAndStats]);
  useEffect(() => { if (!isInventoryOpen) loadPlayerAndStats(); }, [isInventoryOpen, loadPlayerAndStats]);

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
        .maybeSingle();

      if (graveError) {
        console.error('Failed to fetch grave:', graveError);
        addLog('Failed to retrieve your grave. It may have been lost to the depths.');
        return;
      }

      if (!grave) {
        console.error('No grave found for user');
        addLog('No grave found at this depth.');
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

      const INVENTORY_LIMIT = 30; // Default inventory limit
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
      loadPlayerAndStats().catch(err => {
        console.error('Error reloading stats:', err);
      });
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
  if (!player) return <div className="h-screen flex items-center justify-center text-zinc-500">Loading Abyss...</div>;

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-mono max-w-md mx-auto border-x border-zinc-800 relative overflow-hidden">
      
      <div className={`pointer-events-none absolute inset-0 z-50 ${damageFlash ? 'animate-damage' : ''}`} />

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

      <header className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <StatsDisplay
          profile={player}
          onUpgrade={handleStatUpgrade}
        />
        <div className="flex gap-4 mt-3 text-sm">
          <div className="flex items-center gap-2 text-red-400"><Sword size={16} /><span className="font-bold">{derivedStats.attack} ATK</span></div>
          <div className="flex items-center gap-2 text-blue-400"><Shield size={16} /><span className="font-bold">{derivedStats.defense} DEF</span></div>
        </div>
      </header>

      <section className="flex-1 overflow-hidden relative">
        <GameLog logs={logs} />
        {isTownOpen && (
          <Town
            userId={userId}
            player={player}
            onClose={() => setIsTownOpen(false)}
            onRest={(u) => setPlayer({ ...player, ...u })}
            onGoldUpgrade={handleGoldUpgrade}
          />
        )}
        <InventoryModal
          userId={userId}
          isOpen={isInventoryOpen}
          onClose={() => setIsInventoryOpen(false)}
        />
        {/* Floating Retrieve Souls Button */}
        {canRetrieve && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center z-50 pointer-events-auto px-4">
            <button
              onClick={handleRetrieveGrave}
              disabled={retrieving}
              className="bg-zinc-800 hover:bg-zinc-700 text-red-400 px-4 py-2 rounded font-bold text-xs border border-red-500/50 transition-all hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg w-full max-w-xs"
            >
              {retrieving ? 'RETRIEVING...' : 'RETRIEVE SOULS'}
            </button>
          </div>
        )}
      </section>

      <footer className="p-4 border-t border-zinc-800 bg-zinc-900 grid grid-cols-3 gap-2">
        <button onClick={() => setIsTownOpen(!isTownOpen)} className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-yellow-500 transition-colors">{player.depth > 0 ? 'CAMP' : 'TOWN'}</button>
        <button onClick={handleDescend} disabled={loopLoading || isTownOpen || isInventoryOpen} className="bg-zinc-100 hover:bg-white text-black p-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transform duration-75">
          {loopLoading ? '...' : 'DESCEND'}
        </button>
        <button onClick={() => setIsInventoryOpen(true)} className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-blue-400 transition-colors">BAG</button>
      </footer>
    </main>
  );
}