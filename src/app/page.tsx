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

const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

type FloatingText = {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
};

export default function Home() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [derivedStats, setDerivedStats] = useState({ attack: 0, defense: 0 });
  
  const [isTownOpen, setIsTownOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const [damageFlash, setDamageFlash] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

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

  const { handleDescend, handleStatUpgrade, logs, loading: loopLoading } = useGameLoop(
    player, 
    (p) => setPlayer(p), 
    handleEffect 
  );

  const loadPlayerAndStats = useCallback(async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', HARDCODED_USER_ID).single();
      const { data: gear } = await supabase.from('inventory').select('*, item:items(*)').eq('user_id', HARDCODED_USER_ID).eq('is_equipped', true);

      let bonusAttack = 0, bonusDefense = 0;
      gear?.forEach((entry: any) => {
        bonusAttack += (entry.item.stats?.damage || 0);
        bonusDefense += (entry.item.stats?.defense || 0);
      });

      setPlayer(profile);
      setDerivedStats({
        attack: (profile.precision || 0) + bonusAttack,
        defense: (profile.vigor || 0) + bonusDefense,
      });

    } catch (error) { console.error(error); }
  }, []);

  useEffect(() => { loadPlayerAndStats(); }, [loadPlayerAndStats]);
  useEffect(() => { if (!isInventoryOpen) loadPlayerAndStats(); }, [isInventoryOpen, loadPlayerAndStats]);

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
        <StatsDisplay profile={player} onUpgrade={handleStatUpgrade} />
        <div className="flex gap-4 mt-3 text-sm">
          <div className="flex items-center gap-2 text-red-400"><Sword size={16} /><span className="font-bold">{derivedStats.attack} ATK</span></div>
          <div className="flex items-center gap-2 text-blue-400"><Shield size={16} /><span className="font-bold">{derivedStats.defense} DEF</span></div>
        </div>
      </header>

      <section className="flex-1 overflow-hidden relative">
        <GameLog logs={logs} />
        {isTownOpen && <Town player={player} onClose={() => setIsTownOpen(false)} onRest={(u) => setPlayer({ ...player, ...u })} />}
        <InventoryModal isOpen={isInventoryOpen} onClose={() => setIsInventoryOpen(false)} />
      </section>

      <footer className="p-4 border-t border-zinc-800 bg-zinc-900 grid grid-cols-3 gap-2">
        <button onClick={() => setIsTownOpen(!isTownOpen)} className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-yellow-500 transition-colors">TOWN</button>
        <button onClick={handleDescend} disabled={loopLoading || isTownOpen || isInventoryOpen} className="bg-zinc-100 hover:bg-white text-black p-3 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transform duration-75">
          {loopLoading ? '...' : 'DESCEND'}
        </button>
        <button onClick={() => setIsInventoryOpen(true)} className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded font-bold text-blue-400 transition-colors">BAG</button>
      </footer>
    </main>
  );
}