import type { PlayerProfile } from '@/types';
import { Heart, Zap, Coins, ArrowDown, Plus, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface StatsProps {
  profile: PlayerProfile;
  onUpgrade?: (stat: 'vigor' | 'precision' | 'aether') => void;
}

const STAT_INFO = {
  vigor: { label: 'Survival', desc: 'Increases Defense and Max HP/Energy.' },
  precision: { label: 'Combat', desc: 'Increases Attack Dmg and Crit Chance.' },
  aether: { label: 'Greed', desc: 'Increases Gold Find and Warp Cost Reduction.' }
};

// THE NEW BIOME HELPER
function getBiomeName(depth: number) {
  if (depth < 500) return "The Shallows";
  if (depth < 1500) return "Moss Gardens";
  if (depth < 3000) return "Crystal Catacombs";
  return "The Void";
}

export default function StatsDisplay({ profile, onUpgrade }: StatsProps) {
  if (!profile) return null;

  const [activeStat, setActiveStat] = useState<string | null>(null);

  // Use health if available, otherwise fall back to vigor (which was used as health in older versions), then max_health, then max_stamina
  const currentHealth = profile.health ?? profile.vigor ?? profile.max_health ?? profile.max_stamina ?? 100;
  const maxHealth = profile.max_health ?? profile.max_stamina ?? 100;
  const hpPercent = Math.min(100, (currentHealth / maxHealth) * 100);
  const stamPercent = Math.min(100, (profile.current_stamina / profile.max_stamina) * 100);
  const xpPercent = Math.min(100, (profile.xp / (profile.level * 100)) * 100);

  return (
    <div className="space-y-4">

      {/* Top Row */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          {/* DISPLAY BIOME NAME HERE */}
          <div className="mb-2 border-b-2 border-white/20 pb-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={getBiomeName(profile.depth)}
                initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="text-base font-black tracking-[0.25em] uppercase text-white drop-shadow-md"
              >
                {getBiomeName(profile.depth)}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center text-xl font-black text-zinc-100 gap-2">
            <span className="bg-zinc-800 px-2 py-0.5 rounded text-sm">LVL {profile.level}</span>
            {profile.stat_points > 0 && (
              <span className="text-xs text-yellow-500 animate-pulse font-bold">({profile.stat_points} PTS)</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1 text-zinc-400 font-bold text-lg">
            <ArrowDown size={18} /> {profile.depth}m
          </div>
          {profile.max_depth !== undefined && profile.max_depth > 0 && (
            <div className="text-xs text-zinc-500 font-semibold">
              Best: {profile.max_depth}m
            </div>
          )}
          <div className="flex items-center gap-2 text-yellow-500 font-bold">
            {profile.gold} <Coins size={16} />
          </div>
        </div>
      </div>

      {/* BARS */}
      <div className="space-y-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
        {/* HP */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold px-1 uppercase tracking-wider text-red-400">
            <span className="flex items-center gap-1"><Heart size={10} fill="currentColor" /> Health</span>
            <span className="text-zinc-500">{currentHealth} / {maxHealth}</span>
          </div>
          <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
            <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${hpPercent}%` }} />
          </div>
        </div>

        {/* Energy */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold px-1 uppercase tracking-wider text-emerald-400">
            <span className="flex items-center gap-1"><Zap size={10} fill="currentColor" /> Energy</span>
            <span className="text-zinc-500">{profile.current_stamina} / {profile.max_stamina}</span>
          </div>
          <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${stamPercent}%` }} />
          </div>
        </div>

        {/* XP */}
        <div className="space-y-1 pt-1 border-t border-zinc-800/50">
          <div className="flex justify-between text-[10px] font-bold px-1 uppercase tracking-wider text-blue-400">
            <span className="flex items-center gap-1"><Star size={10} fill="currentColor" /> XP</span>
            <span className="text-zinc-500">{Math.floor(xpPercent)}%</span>
          </div>
          <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Stats Buttons */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {['vigor', 'precision', 'aether'].map((stat) => (
          <div
            key={stat}
            onClick={() => setActiveStat(activeStat === stat ? null : stat)}
            className="bg-zinc-900 p-2 rounded border border-zinc-800 flex flex-col items-center relative group cursor-pointer overflow-hidden"
          >
            <span className="text-[10px] uppercase text-zinc-500 tracking-wider">{stat}</span>
            <span className="font-bold text-lg text-zinc-200">
              {profile[stat as keyof PlayerProfile]}
            </span>

            {profile.stat_points > 0 && onUpgrade && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpgrade(stat as 'vigor' | 'precision' | 'aether');
                }}
                className="absolute -top-2 -right-2 bg-yellow-500 text-black rounded-full p-1 shadow-lg hover:scale-110 transition-transform hover:bg-yellow-400 z-20"
              >
                <Plus size={12} strokeWidth={4} />
              </button>
            )}

            {activeStat === stat && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStat(null);
                }}
                className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-2 text-center z-10 animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="text-xs font-bold text-white mb-1">
                  {STAT_INFO[stat as keyof typeof STAT_INFO].label}
                </div>
                <div className="text-[10px] text-zinc-400 leading-tight">
                  {STAT_INFO[stat as keyof typeof STAT_INFO].desc}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}