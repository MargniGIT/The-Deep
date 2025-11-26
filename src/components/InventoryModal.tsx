import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useInventory } from '@/hooks/useInventory';
import { X, Shield, Sword, Box } from 'lucide-react';
import type { InventoryItem } from '@/types';
import ItemIcon from './ItemIcon';

interface InventoryModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to get rarity-based styles
function getRarityStyle(rarity: string): { text: string; border: string } {
  switch (rarity?.toLowerCase()) {
    case 'legendary':
      return { text: 'text-legendary', border: 'border-amber-500/50 bg-amber-950/10' };
    case 'set':
      return { text: 'text-emerald-400 font-bold', border: 'border-emerald-500/50 bg-emerald-950/10' };
    case 'artifact':
      return { text: 'text-purple-400 font-bold', border: 'border-purple-500/50 bg-purple-950/10' };
    case 'rare':
      return { text: 'text-blue-400 font-bold', border: 'border-blue-500/50 bg-blue-950/10' };
    case 'uncommon':
      return { text: 'text-green-400', border: 'border-green-500/30' };
    case 'junk':
      return { text: 'text-zinc-600', border: 'border-zinc-800 opacity-75' };
    default:
      return { text: 'text-zinc-200', border: 'border-zinc-700' };
  }
}

export default function InventoryModal({ userId, isOpen, onClose }: InventoryModalProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [inspectId, setInspectId] = useState<number | null>(null);
  const { equipItem, unequipItem, scrapItem, loading: actionLoading } = useInventory(userId);

  // Fetch Inventory
  const loadInventory = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('inventory')
      .select('*, item:items(*)')
      .eq('user_id', userId)
      .order('is_equipped', { ascending: false });

    if (error) {
      console.error('Error loading inventory:', error);
    } else {
      setItems(data || []);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) loadInventory();
  }, [isOpen, loadInventory]);

  const handleItemAction = async (inventoryItem: InventoryItem) => {
    // Unequip
    if (inventoryItem.is_equipped) {
      const success = await unequipItem(inventoryItem.id);
      if (success) await loadInventory();
      return;
    }

    // Equip
    const targetSlot = inventoryItem.item.valid_slot;
    if (targetSlot) {
      const success = await equipItem(inventoryItem.id, targetSlot);
      if (success) await loadInventory();
    } else {
      alert("You can't equip this!");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-lg rounded-lg shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-900 rounded-t-lg">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Box size={20} className="text-blue-400" /> Backpack
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/50">
          {items.length === 0 ? (
            <div className="text-zinc-500 text-center py-10 flex flex-col items-center gap-2">
              <Box size={40} className="opacity-20" />
              <span>Your bag is empty.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {items.map((entry) => {
                const stats = entry.stats_override || entry.item.stats || {};
                const style = getRarityStyle(entry.item.rarity);

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center p-3 rounded border transition-colors relative ${entry.is_equipped
                      ? `bg-zinc-900 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]`
                      : `bg-zinc-900/50 ${style.border} hover:border-zinc-700`
                      }`}
                  >
                    {/* Icon Box - Clickable */}
                    <div 
                      onClick={() => setInspectId(inspectId === entry.id ? null : entry.id)}
                      className={`w-12 h-12 rounded flex items-center justify-center mr-4 border shrink-0 cursor-pointer transition-all hover:scale-105 ${entry.is_equipped
                        ? 'bg-green-950/30 border-green-500/30 text-green-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                        }`}
                    >
                      <ItemIcon slug={entry.item.icon_slug} className="w-8 h-8" />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0 relative">
                      {/* Dark Overlay when inspecting */}
                      {inspectId === entry.id && (
                        <div 
                          onClick={() => setInspectId(null)}
                          className="absolute inset-0 bg-black/90 backdrop-blur-sm rounded z-10 flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
                        >
                          <p className="text-zinc-400 italic text-sm text-center">
                            {entry.item.description || 'No description'}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span className={`font-bold truncate text-sm flex-1 min-w-0 ${style.text}`}>
                          {entry.name_override || entry.item.name}
                        </span>
                        {entry.is_equipped && (
                          <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 font-bold tracking-wider shrink-0">
                            EQUIPPED
                          </span>
                        )}
                      </div>

                      {/* STATS DISPLAY ROW */}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {/* Damage Badge */}
                        {stats.damage && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/30">
                            <Sword size={10} /> +{stats.damage} ATK
                          </span>
                        )}
                        {/* Defense Badge */}
                        {stats.defense && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-900/30">
                            <Shield size={10} /> +{stats.defense} DEF
                          </span>
                        )}
                        {/* Generic Badge for other stats (like Value or Regen) */}
                        {Object.entries(stats).map(([key, value]) => {
                          if (key === 'damage' || key === 'defense') return null; // Skip ones we already showed
                          if (value === 0 || value === null || value === undefined) return null; // Don't show zero or null values
                          return (
                            <span key={key} className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                              <span className="capitalize">{key}:</span> {String(value)}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Button */}
                    <button
                      disabled={actionLoading}
                      onClick={() => handleItemAction(entry)}
                      className={`ml-3 text-xs px-3 py-2 rounded font-bold transition-all min-w-[70px] ${entry.is_equipped
                        ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border border-zinc-700'
                        : entry.item.valid_slot
                          ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                          : 'bg-transparent text-zinc-600 cursor-not-allowed italic'
                        }`}
                    >
                      {entry.is_equipped ? 'UNEQUIP' : entry.item.valid_slot ? 'EQUIP' : '-'}
                    </button>

                    {/* SCRAP BUTTON */}
                    {!entry.is_equipped && entry.item.type !== 'material' && (
                      <button
                        disabled={actionLoading}
                        onClick={async () => {
                          if (confirm(`Scrap ${entry.item.name} for parts?`)) {
                            const success = await scrapItem(entry.id);
                            if (success) await loadInventory();
                          }
                        }}
                        className="ml-2 text-xs px-3 py-2 rounded font-bold transition-all bg-zinc-800 text-zinc-500 hover:bg-red-900/30 hover:text-red-400 border border-zinc-700 hover:border-red-500/30"
                      >
                        SCRAP
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}