import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useInventory } from '@/hooks/useInventory';
import { X, Shield, Sword, Box } from 'lucide-react'; // Make sure you have lucide-react installed

// The ID we are pretending to be
const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const { equipItem, unequipItem, loading: actionLoading } = useInventory();

  // Fetch Inventory from DB
  const loadInventory = async () => {
    console.log("Loading inventory...");
    const { data, error } = await supabase
      .from('inventory')
      .select('*, item:items(*)') // Join with items table
      .eq('user_id', HARDCODED_USER_ID)
      .order('is_equipped', { ascending: false }); // Show equipped first

    if (error) {
      console.error('Error loading inventory:', error);
    } else {
      setItems(data || []);
    }
  };

  // Reload when opening
  useEffect(() => {
    if (isOpen) {
      loadInventory();
    }
  }, [isOpen]);

  // Handle the Button Click
  const handleItemAction = async (inventoryItem: any) => {
    // 1. UNEQUIP LOGIC
    if (inventoryItem.is_equipped) {
      const success = await unequipItem(inventoryItem.id);
      if (success) await loadInventory(); // Refresh UI
      return;
    }

    // 2. EQUIP LOGIC
    const targetSlot = inventoryItem.item.valid_slot;
    
    if (targetSlot) {
      const success = await equipItem(inventoryItem.id, targetSlot);
      if (success) await loadInventory(); // Refresh UI
    } else {
      alert("This item cannot be equipped!");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-lg rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Box size={20} /> Backpack
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-zinc-500 text-center py-10">Your bag is empty.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {items.map((entry) => (
                <div 
                  key={entry.id} 
                  className={`flex items-center p-3 rounded border ${
                    entry.is_equipped 
                      ? 'bg-zinc-800 border-green-500/50' 
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  {/* Icon Placeholder */}
                  <div className={`w-10 h-10 rounded flex items-center justify-center mr-3 ${
                    entry.is_equipped ? 'bg-green-900/20 text-green-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {entry.item.valid_slot === 'main_hand' ? <Sword size={18}/> : <Shield size={18}/>}
                  </div>

                  {/* Text Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        entry.item.rarity === 'rare' ? 'text-blue-400' : 'text-zinc-200'
                      }`}>
                        {entry.item.name}
                      </span>
                      {entry.is_equipped && (
                        <span className="text-xs bg-green-900 text-green-400 px-1.5 py-0.5 rounded">EQUIPPED</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 capitalize">
                      {entry.item.rarity} {entry.item.type}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    disabled={actionLoading}
                    onClick={() => handleItemAction(entry)}
                    className={`text-xs px-3 py-1.5 rounded font-bold transition-colors ${
                      entry.is_equipped
                        ? 'bg-zinc-800 text-zinc-400 hover:text-red-400'
                        : entry.item.valid_slot
                          ? 'bg-blue-600 text-white hover:bg-blue-500'
                          : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    {entry.is_equipped ? 'UNEQUIP' : entry.item.valid_slot ? 'EQUIP' : '---'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}