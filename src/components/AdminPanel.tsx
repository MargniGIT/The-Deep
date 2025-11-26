'use client';

import { useState } from 'react';
import type { PlayerProfile } from '@/types';
import { supabase } from '@/lib/supabase';

interface AdminPanelProps {
  player: PlayerProfile;
  onUpdate?: (updates: Partial<PlayerProfile>) => void;
}

export default function AdminPanel({ player, onUpdate }: AdminPanelProps) {
  const [loading, setLoading] = useState(false);

  // Security check: If not admin, return null immediately
  if (!player.is_admin) {
    return null;
  }

  const handleAddGold = async () => {
    if (!player.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ gold: (player.gold || 0) + 1000 })
        .eq('id', player.id);

      if (error) {
        console.error('Failed to add gold:', error);
      } else {
        onUpdate?.({ gold: (player.gold || 0) + 1000 });
        window.location.reload();
      }
    } catch (error) {
      console.error('Error adding gold:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHeal = async () => {
    if (!player.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          vigor: player.max_stamina || 20,
          current_stamina: player.max_stamina || 20,
        })
        .eq('id', player.id);

      if (error) {
        console.error('Failed to heal:', error);
      } else {
        onUpdate?.({
          vigor: player.max_stamina || 20,
          current_stamina: player.max_stamina || 20,
        });
        window.location.reload();
      }
    } catch (error) {
      console.error('Error healing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeleportDeep = async () => {
    if (!player.id) return;
    setLoading(true);
    try {
      const newDepth = (player.depth || 0) + 100;
      const { error } = await supabase
        .from('profiles')
        .update({ depth: newDepth })
        .eq('id', player.id);

      if (error) {
        console.error('Failed to teleport:', error);
      } else {
        onUpdate?.({ depth: newDepth });
        window.location.reload();
      }
    } catch (error) {
      console.error('Error teleporting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetRun = async () => {
    if (!player.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ depth: 0 })
        .eq('id', player.id);

      if (error) {
        console.error('Failed to reset run:', error);
      } else {
        onUpdate?.({ depth: 0 });
        window.location.reload();
      }
    } catch (error) {
      console.error('Error resetting run:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-auto">
      <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 shadow-lg">
        <div className="text-xs font-bold text-yellow-500 mb-2">DEV TOOLS</div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAddGold}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-yellow-600/80 hover:bg-yellow-600 text-white rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add 1000 Gold
          </button>
          <button
            onClick={handleHeal}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-green-600/80 hover:bg-green-600 text-white rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Heal
          </button>
          <button
            onClick={handleTeleportDeep}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-purple-600/80 hover:bg-purple-600 text-white rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Teleport Deep
          </button>
          <button
            onClick={handleResetRun}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-red-600/80 hover:bg-red-600 text-white rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Run
          </button>
        </div>
      </div>
    </div>
  );
}

