import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useInventory } from '@/hooks/useInventory';
import { X, Shield, Sword, Box } from 'lucide-react';
import type { InventoryItem } from '@/types';
import ItemIcon from './ItemIcon';
import { useAudio } from '@/hooks/useAudio';
import { useToast } from '@/context/ToastContext';

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

// Helper function to get rarity sort order (lower = higher priority)
function getRaritySortOrder(rarity: string): number {
  switch (rarity?.toLowerCase()) {
    case 'legendary': return 1;
    case 'artifact': return 2;
    case 'set': return 3;
    case 'epic': return 4;
    case 'rare': return 5;
    case 'uncommon': return 6;
    case 'common': return 7;
    case 'junk': return 8;
    default: return 9;
  }
}

// Helper function to check if item is junk
function isJunk(item: InventoryItem): boolean {
  return item.item.rarity?.toLowerCase() === 'junk' || 
         item.item.type?.toLowerCase() === 'junk';
}

// Sort inventory items: Equipped first, then items by rarity, then junk last
function sortInventoryItems(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    // 1. Equipped items always come first
    if (a.is_equipped && !b.is_equipped) return -1;
    if (!a.is_equipped && b.is_equipped) return 1;
    
    // 2. Within equipped/unequipped groups, separate junk from items
    const aIsJunk = isJunk(a);
    const bIsJunk = isJunk(b);
    
    if (!aIsJunk && bIsJunk) return -1; // Items before junk
    if (aIsJunk && !bIsJunk) return 1;   // Junk after items
    
    // 3. Within same category (both junk or both items), sort by rarity
    const aRarityOrder = getRaritySortOrder(a.item.rarity);
    const bRarityOrder = getRaritySortOrder(b.item.rarity);
    
    if (aRarityOrder !== bRarityOrder) {
      return aRarityOrder - bRarityOrder;
    }
    
    // 4. Same rarity, sort alphabetically by name
    const aName = (a.name_override || a.item.name || '').toLowerCase();
    const bName = (b.name_override || b.item.name || '').toLowerCase();
    
    return aName.localeCompare(bName);
  });
}

export default function InventoryModal({ userId, isOpen, onClose }: InventoryModalProps) {
  const { playSfx, playHover } = useAudio();
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [inspectId, setInspectId] = useState<number | null>(null);
  const [pendingScrapId, setPendingScrapId] = useState<number | null>(null);
  const { equipItem, unequipItem, scrapItem, loading: actionLoading } = useInventory(userId);

  // Fetch Inventory
  const loadInventory = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('inventory')
      .select('*, item:items(*)')
      .eq('user_id', userId);

    if (error) {
      console.error('Error loading inventory:', error);
    } else {
      // Sort items: equipped first, then items by rarity, then junk last
      const sortedItems = sortInventoryItems((data || []) as InventoryItem[]);
      setItems(sortedItems);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) loadInventory();
  }, [isOpen, loadInventory]);

  // Reset pending scrap confirmation after 3 seconds
  useEffect(() => {
    if (pendingScrapId !== null) {
      const timer = setTimeout(() => {
        setPendingScrapId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pendingScrapId]);

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
      toast.error("You can't equip this!");
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
          <button onClick={() => { playSfx('ui_click'); onClose(); }} onMouseEnter={() => playHover()} className="text-zinc-400 hover:text-white transition-colors">
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
                      className={`w-12 h-12 rounded flex items-center justify-center mr-4 border shrink-0 cursor-pointer transition-all hover:scale-105 relative ${entry.is_equipped
                        ? 'bg-green-950/30 border-green-500/30 text-green-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                        }`}
                    >
                      <ItemIcon slug={entry.item.icon_slug} className="w-8 h-8" />
                      {/* Quantity Badge */}
                      {(entry.quantity || 0) > 1 && (
                        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-blue-400 min-w-[18px] text-center">
                          x{entry.quantity}
                        </span>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0 relative">
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
                      onClick={() => { playSfx('ui_click'); handleItemAction(entry); }}
                      onMouseEnter={() => playHover()}
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
                          playSfx('ui_click');
                          const quantity = entry.quantity || 1;
                          const itemName = entry.name_override || entry.item.name;
                          const scrapValue = (entry.item.scrap_value || entry.item.value || 0) * quantity;
                          
                          // Double-tap logic: First click sets pending, second click executes
                          if (pendingScrapId === entry.id) {
                            // Second click: Execute scrap
                            setPendingScrapId(null);
                            const success = await scrapItem(entry.id);
                            if (success) {
                              toast.success(`Scrapped ${itemName}${quantity > 1 ? ` (x${quantity})` : ''} for ${scrapValue} Metal.`);
                              await loadInventory();
                            }
                          } else {
                            // First click: Set pending confirmation
                            setPendingScrapId(entry.id);
                          }
                        }}
                        onMouseEnter={() => playHover()}
                        className={`ml-2 text-xs px-3 py-2 rounded font-bold transition-all border ${
                          pendingScrapId === entry.id
                            ? 'bg-red-900/50 text-red-200 border-red-500/50 hover:bg-red-800/50'
                            : 'bg-zinc-800 text-zinc-500 hover:bg-red-900/30 hover:text-red-400 border-zinc-700 hover:border-red-500/30'
                        }`}
                      >
                        {pendingScrapId === entry.id ? 'CONFIRM?' : 'SCRAP'}
                      </button>
                    )}

                    {/* Dark Overlay when inspecting */}
                    {inspectId === entry.id && (
                      <div 
                        onClick={() => setInspectId(null)}
                        className="absolute inset-0 bg-black/90 backdrop-blur-sm rounded z-10 flex items-center justify-center p-3 animate-in fade-in duration-200 cursor-pointer"
                      >
                        <div className="w-full max-w-full overflow-y-auto overflow-x-hidden max-h-full text-zinc-400 italic text-xs text-center">
                          {(() => {
                            const desc = entry.item.description || 'No description';
                            if (!desc.includes('SET BONUS')) {
                              return <p className="whitespace-pre-wrap break-words px-2">{desc}</p>;
                            }
                            // Parse and highlight SET BONUS sections
                            const parts = desc.split(/(SET BONUS[^\n]*)/gi);
                            return (
                              <p className="whitespace-pre-wrap break-words px-2">
                                {parts.map((part, idx) => 
                                  part.toUpperCase().includes('SET BONUS') ? (
                                    <span key={idx} className="text-emerald-400">{part}</span>
                                  ) : (
                                    <span key={idx}>{part}</span>
                                  )
                                )}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
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