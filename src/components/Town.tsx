import { useState } from 'react';
import { X, Home, Bed, ArrowLeft } from 'lucide-react';
import type { PlayerProfile } from '@/types';
import { supabase } from '@/lib/supabase';

const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

interface TownProps {
  player: PlayerProfile | null;
  onClose: () => void;
  // UPDATE: We now expect onRest to accept the NEW values
  onRest: (updates: Partial<PlayerProfile>) => void; 
}

export default function Town({ player, onClose, onRest }: TownProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!player) return null;

  const handleRest = async () => {
    if (player.gold < 10) {
      setMessage("You don't have enough gold!");
      return;
    }

    setLoading(true);
    
    // 1. Calculate the new values LOCALLY
    const newGold = player.gold - 10;
    const newStamina = player.max_stamina;
    const newVigor = player.vigor;

    try {
      // 2. Update DB
      const { error } = await supabase
        .from('profiles')
        .update({ 
          gold: newGold,
          current_stamina: newStamina,
          vigor: newVigor 
        })
        .eq('id', HARDCODED_USER_ID);

      if (error) throw error;

      setMessage("You slept soundly. You feel refreshed.");
      
      // 3. FORCE THE UI TO UPDATE INSTANTLY
      // We don't wait for a fetch. We tell the app: "Here are the new numbers."
      onRest({ 
        gold: newGold, 
        current_stamina: newStamina, 
        vigor: newVigor 
      });
      
    } catch (err) {
      console.error(err);
      setMessage("The innkeeper refused service (Error).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-zinc-950/95 z-40 flex flex-col p-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Home className="text-yellow-500" size={24} />
          <h2 className="text-2xl font-bold text-zinc-100">The Outpost</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
        
        <div className="text-center space-y-2">
          <div className="text-zinc-500 uppercase tracking-widest text-xs">Current Wealth</div>
          {/* Displays current gold from props */}
          <div className="text-4xl font-bold text-yellow-500">{player.gold} Gold</div>
        </div>

        {message && (
          <div className="bg-zinc-900 px-4 py-2 rounded text-zinc-300 border border-zinc-700">
            {message}
          </div>
        )}

        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-lg hover:border-zinc-600 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-800 p-2 rounded text-blue-400 group-hover:text-blue-300">
                <Bed size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Rest & Recover</h3>
                <p className="text-zinc-500 text-sm">Restore 100% Stamina</p>
              </div>
            </div>
            <div className="bg-zinc-950 px-3 py-1 rounded text-yellow-500 font-mono text-sm border border-zinc-800">
              10 G
            </div>
          </div>
          
          <button 
            onClick={handleRest}
            disabled={loading || player.gold < 10}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-all disabled:opacity-50 disabled:bg-zinc-700"
          >
            {loading ? 'Sleeping...' : 'Rent Room'}
          </button>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-zinc-800">
        <button onClick={onClose} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mx-auto">
          <ArrowLeft size={16} /> Return to the Deep
        </button>
      </div>
    </div>
  );
}