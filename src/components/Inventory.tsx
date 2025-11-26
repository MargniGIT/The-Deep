import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useInventory } from '@/hooks/useInventory';
import { X, Shield, Sword, Box } from 'lucide-react';
import type { InventoryItem } from '@/types';

// The ID we are pretending to be
const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);

  const { equipItem, unequipItem, scrapItem, loading: actionLoading } = useInventory();

  // Fetch Inventory from DB
  const loadInventory = useCallback(async () => {
    // Join with items table to get names/stats
    const { data, error } = await supabase
      .from('inventory')
      .select('*, item:items(*)')
      .eq('user_id', HARDCODED_USER_ID)
      .order('is_equipped', { ascending: false }); // Equipped items first

    if (error) {
      console.error('Error loading inventory:', error);
    } else {
      setItems((data as unknown as InventoryItem[]) || []);
    }
  }, []);

  // Reload when opening or when an action completes
  useEffect(() => {
    if (isOpen) {
      loadInventory();
    }
  }, [isOpen, loadInventory]);

  const handleItemAction = async (inventoryItem: InventoryItem) => {
    // 1. UNEQUIP LOGIC
    if (inventoryItem.is_equipped) {
      const success = await unequipItem(inventoryItem.id);
      if (success) await loadInventory();
      return;
    }

    // 2. EQUIP LOGIC
    const targetSlot = inventoryItem.item.valid_slot;

    if (targetSlot) {
      const success = await equipItem(inventoryItem.id, targetSlot);
      if (success) await loadInventory();
    } else {
      // It's a consumable or material
      alert("You can't equip this!");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
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
              {items.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center p-3 rounded border transition-colors ${entry.is_equipped
                    ? 'bg-zinc-900 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded flex items-center justify-center mr-4 border ${entry.is_equipped
                    ? 'bg-green-950/30 border-green-500/30 text-green-400'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                    }`}>
                    {entry.item.valid_slot === 'main_hand' ? <Sword size={20} /> : <Shield size={20} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold truncate ${entry.item.rarity === 'rare' ? 'text-blue-400' :
                        entry.item.rarity === 'uncommon' ? 'text-green-400' : 'text-zinc-200'
                        }`}>
                        {entry.item.name}
                      </span>
                      {entry.is_equipped && (
                        <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 font-bold tracking-wider">
                          EQUIPPED
                        </span>
                      )}
                    </div>

                    {/* Stats Display */}
                    <div className="text-xs text-zinc-500 flex gap-3">
                      {entry.item.stats && Object.entries(entry.item.stats).map(([key, value]) => (
                        <span key={key} className="flex items-center gap-1 bg-zinc-950 px-1.5 rounded">
                          <span className="capitalize text-zinc-400">{key}:</span>
                          <span className="text-zinc-200">+{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    disabled={actionLoading}
                    onClick={() => handleItemAction(entry)}
                    className={`ml-3 text-xs px-4 py-2 rounded font-bold transition-all min-w-[80px] ${entry.is_equipped
                      ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border border-zinc-700'
                      : entry.item.valid_slot
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                        : 'bg-transparent text-zinc-600 cursor-not-allowed italic'
                      }`}
                  >
                    {entry.is_equipped ? 'UNEQUIP' : entry.item.valid_slot ? 'EQUIP' : 'PASSIVE'}
                  </button>

                  {/* SCRAP BUTTON */}
                  {!entry.is_equipped && (
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}