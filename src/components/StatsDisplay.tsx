import type { PlayerProfile } from '@/types';
import { Heart, Zap, Coins, ArrowDown } from 'lucide-react';

interface StatsProps {
  profile: PlayerProfile;
}

export default function StatsDisplay({ profile }: StatsProps) {
  if (!profile) return null;

  // Calculate percentages for the bars
  const hpPercent = Math.max(0, Math.min(100, (profile.vigor / profile.max_stamina) * 100));
  const stamPercent = Math.max(0, Math.min(100, (profile.current_stamina / profile.max_stamina) * 100));

  return (
    <div className="space-y-4">
      {/* Top Row: Depth & Gold */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 font-bold tracking-widest uppercase">Current Depth</span>
          <div className="flex items-center text-3xl font-black text-zinc-100">
            <ArrowDown className="mr-2 text-zinc-600" size={24} />
            {profile.depth}m
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 text-yellow-500 font-bold text-xl">
            {profile.gold} <Coins size={18} />
          </div>
        </div>
      </div>

      {/* Bars Container */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* HEALTH BAR */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold px-1">
            <span className="text-red-400 flex items-center gap-1"><Heart size={10} fill="currentColor" /> HEALTH</span>
            <span className="text-zinc-500">{profile.vigor} / {profile.max_stamina}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all duration-300 ease-out"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* STAMINA BAR */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold px-1">
            <span className="text-emerald-400 flex items-center gap-1"><Zap size={10} fill="currentColor" /> ENERGY</span>
            <span className="text-zinc-500">{profile.current_stamina} / {profile.max_stamina}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${stamPercent}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}