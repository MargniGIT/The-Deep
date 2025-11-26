'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import StatsDisplay from '@/components/StatsDisplay';
import GameLog from '@/components/GameLog';
import Town from '@/components/Town';
import InventoryModal from '@/components/InventoryModal'; // <--- NEW COMPONENT
import { supabase } from '@/lib/supabase';
import type { PlayerProfile } from '@/types';
import { Shield, Sword } from 'lucide-react';

// The ID we are pretending to be (Must match your DB)
const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

export default function Home() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [derivedStats, setDerivedStats] = useState({ attack: 0, defense: 0 });
  
  const [isTownOpen, setIsTownOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  // Game Loop Hook
  const { handleDescend, handleStatUpgrade, logs, loading: loopLoading } = useGameLoop(
    player, 
    (p) => setPlayer(p), 
    () => {} 
  );

  // 1. Load Player & Calculate Gear Stats
  const loadPlayerAndStats = useCallback(async () => {
    try {
      // A. Fetch Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', HARDCODED_USER_ID)
        .single();

      if (profileError) throw profileError;

      // B. Fetch EQUIPPED Items
      const { data: gear, error: gearError } = await supabase
        .from('inventory')
        .select('*, item:items(*)') // Join to get stats
        .eq('user_id', HARDCODED_USER_ID)
        .eq('is_equipped', true);

      if (gearError) throw gearError;

      // C. Calculate Totals
      let bonusAttack = 0;
      let bonusDefense = 0;

      gear?.forEach((entry: any) => {
        const stats = entry.item.stats || {};
        if (stats.damage) bonusAttack += stats.damage;
        if (stats.defense) bonusDefense += stats.defense;
      });

      setPlayer(profile);
      setDerivedStats({
        attack: (profile.precision || 0) + bonusAttack,
        defense: (profile.vigor || 0) + bonusDefense,
      });

    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    loadPlayerAndStats();
  }, [loadPlayerAndStats]);

  // Refresh stats when closing inventory (in case we changed gear)
  useEffect(() => {
    if (!isInventoryOpen) {
      loadPlayerAndStats();
    }
  }, [isInventoryOpen, loadPlayerAndStats]);

  if (!player) return <div className="h-screen flex items-center justify-center text-zinc-500">Loading Abyss...</div>;

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 font-mono max-w-md mx-auto border-x border-zinc-800 relative">
      
      {/* 1. TOP BAR: Status & Combat Stats */}
      <header className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <StatsDisplay profile={player} onUpgrade={handleStatUpgrade} />
        
        {/* Combat Stats Row */}
        <div className="flex gap-4 mt-3 text-sm">
          <div className="flex items-center gap-2 text-red-400">
            <Sword size={16} /> 
            <span className="font-bold">{derivedStats.attack} ATK</span>
          </div>
          <div className="flex items-center gap-2 text-blue-400">
            <Shield size={16} /> 
            <span className="font-bold">{derivedStats.defense} DEF</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN AREA: Log */}
      <section className="flex-1 overflow-hidden relative">
        <GameLog logs={logs} />
        
        {/* Overlays */}
        {isTownOpen && (
          <Town 
            player={player} 
            onClose={() => setIsTownOpen(false)} 
            onRest={(updates) => {
              // Instantly merge the new gold/stamina into the current player state
              if (player) setPlayer({ ...player, ...updates });
            }}
          />
        )}
        
        <InventoryModal 
          isOpen={isInventoryOpen} 
          onClose={() => setIsInventoryOpen(false)} 
        />
      </section>

      {/* 3. BOTTOM BAR: Actions */}
      <footer className="p-4 border-t border-zinc-800 bg-zinc-900 grid grid-cols-3 gap-2">
        <button 
          onClick={() => setIsTownOpen(!isTownOpen)}
          className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-yellow-500 transition-colors"
        >
          TOWN
        </button>

        <button 
          onClick={handleDescend}
          disabled={loopLoading || isTownOpen || isInventoryOpen}
          className="bg-zinc-100 hover:bg-white text-black p-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loopLoading ? '...' : 'DESCEND'}
        </button>

        <button 
          onClick={() => setIsInventoryOpen(true)}
          className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-blue-400 transition-colors"
        >
          BAG
        </button>
      </footer>
    </main>
  );
}