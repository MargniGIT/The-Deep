import { useState, useEffect } from 'react';
import { X, Home, Bed, ArrowLeft, Store, Coins, Trash2 } from 'lucide-react';
import type { PlayerProfile } from '@/types';
import { supabase } from '@/lib/supabase';

const HARDCODED_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

interface TownProps {
  player: PlayerProfile | null;
  onClose: () => void;
  onRest: (updates: Partial<PlayerProfile>) => void; 
}

export default function Town({ player, onClose, onRest }: TownProps) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'main' | 'merchant'>('main'); 
  const [sellItems, setSellItems] = useState<any[]>([]); 
  const [message, setMessage] = useState('');

  if (!player) return null;

  // --- FETCH ITEMS ---
  const loadSellableItems = async () => {
    const { data } = await supabase
      .from('inventory')
      .select('*, item:items(*)')
      .eq('user_id', HARDCODED_USER_ID)
      .eq('is_equipped', false); 

    if (data) setSellItems(data);
  };

  useEffect(() => {
    if (view === 'merchant') {
      loadSellableItems();
    }
  }, [view]);

  // --- ACTIONS ---

  const handleRest = async () => {
    if (player.gold < 10) {
      setMessage("You don't have enough gold!");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ gold: player.gold - 10, current_stamina: player.max_stamina, vigor: player.max_stamina }) 
        .eq('id', HARDCODED_USER_ID);

      if (error) throw error;
      setMessage("Restored HP & Stamina.");
      onRest({ gold: player.gold - 10, current_stamina: player.max_stamina, vigor: player.max_stamina });
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const handleSell = async (inventoryId: number, itemValue: number, itemName: string) => {
    setLoading(true);
    try {
      const { error: delError } = await supabase.from('inventory').delete().eq('id', inventoryId);
      if (delError) throw delError;

      const newGold = player.gold + itemValue;
      const { error: upError } = await supabase.from('profiles').update({ gold: newGold }).eq('id', HARDCODED_USER_ID);
      if (upError) throw upError;

      setMessage(`Sold ${itemName} for ${itemValue} Gold.`);
      onRest({ gold: newGold }); 
      setSellItems((prev) => prev.filter((i) => i.id !== inventoryId)); 

    } catch (err) { console.error(err); setMessage("Error selling item."); } 
    finally { setLoading(false); }
  };

  // --- NEW: BULK SELL LOGIC ---
  const handleBulkSell = async () => {
    // 1. Filter for Commons
    const commonItems = sellItems.filter((i) => i.item.rarity === 'common');
    if (commonItems.length === 0) {
      setMessage("No common items to sell.");
      return;
    }

    setLoading(true);
    try {
      // 2. Calculate Totals
      let totalValue = 0;
      const idsToDelete: number[] = [];

      commonItems.forEach((entry) => {
        totalValue += (entry.item.value || 5);
        idsToDelete.push(entry.id);
      });

      // 3. Batch Delete
      const { error: delError } = await supabase
        .from('inventory')
        .delete()
        .in('id', idsToDelete); // Delete all IDs in the array
      
      if (delError) throw delError;

      // 4. Batch Update Gold
      const newGold = player.gold + totalValue;
      const { error: upError } = await supabase
        .from('profiles')
        .update({ gold: newGold })
        .eq('id', HARDCODED_USER_ID);
      
      if (upError) throw upError;

      // 5. Update UI
      setMessage(`Bulk sold ${idsToDelete.length} items for ${totalValue} Gold.`);
      onRest({ gold: newGold });
      setSellItems((prev) => prev.filter((i) => !idsToDelete.includes(i.id)));

    } catch (err) {
      console.error(err);
      setMessage("Bulk sell failed.");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ---

  // Calculate common value for the button label
  const commonCount = sellItems.filter(i => i.item.rarity === 'common').length;
  const commonValue = sellItems
    .filter(i => i.item.rarity === 'common')
    .reduce((sum, i) => sum + (i.item.value || 5), 0);

  return (
    <div className="absolute inset-0 bg-zinc-950/95 z-40 flex flex-col p-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Home className="text-yellow-500" size={24} />
          <h2 className="text-2xl font-bold text-zinc-100">
            {view === 'main' ? 'The Outpost' : 'Scrap Merchant'}
          </h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
          <X size={24} />
        </button>
      </div>

      {/* Gold Display */}
      <div className="flex justify-center mb-6">
        <div className="bg-zinc-900 border border-zinc-800 px-6 py-2 rounded-full flex items-center gap-2">
          <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Balance</span>
          <span className="text-xl font-bold text-yellow-500 flex items-center gap-1">
            {player.gold} <Coins size={16} />
          </span>
        </div>
      </div>

      {message && (
        <div className="bg-zinc-900 px-4 py-2 rounded text-zinc-300 border border-zinc-700 text-center mb-4 text-sm animate-pulse">
          {message}
        </div>
      )}

      {/* --- VIEW: MAIN MENU --- */}
      {view === 'main' && (
        <div className="flex-1 flex flex-col gap-4">
          <button 
            onClick={handleRest}
            disabled={loading || player.gold < 10}
            className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group disabled:opacity-50"
          >
            <div className="bg-zinc-800 p-3 rounded text-blue-400 group-hover:text-blue-300">
              <Bed size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Rest & Recover</h3>
              <p className="text-zinc-500 text-sm">Restore Health & Energy</p>
            </div>
            <span className="font-mono text-yellow-500 font-bold">10 G</span>
          </button>

          <button 
            onClick={() => { setView('merchant'); setMessage(''); }}
            className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group"
          >
            <div className="bg-zinc-800 p-3 rounded text-green-400 group-hover:text-green-300">
              <Store size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Scrap Merchant</h3>
              <p className="text-zinc-500 text-sm">Sell loot for Gold</p>
            </div>
          </button>
        </div>
      )}

      {/* --- VIEW: MERCHANT --- */}
      {view === 'merchant' && (
        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
          
          {/* BULK SELL BUTTON */}
          {commonCount > 0 && (
            <button
              onClick={handleBulkSell}
              disabled={loading}
              className="w-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-red-500/50 p-3 rounded-lg flex items-center justify-between mb-4 group transition-all"
            >
              <div className="flex items-center gap-2 text-zinc-300 group-hover:text-white">
                <Trash2 size={18} />
                <span className="font-bold">Sell All Junk ({commonCount})</span>
              </div>
              <span className="text-yellow-500 font-bold">+{commonValue} G</span>
            </button>
          )}

          {sellItems.length === 0 ? (
            <div className="text-zinc-500 text-center py-10">Nothing to sell.</div>
          ) : (
            sellItems.map((entry) => (
              <div key={entry.id} className="flex justify-between items-center bg-zinc-900 p-3 rounded border border-zinc-800">
                <div>
                  <div className={`font-bold text-sm ${entry.item.rarity === 'rare' ? 'text-blue-400' : entry.item.rarity === 'uncommon' ? 'text-green-400' : 'text-zinc-200'}`}>
                    {entry.item.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase">{entry.item.type}</div>
                </div>
                <button
                  onClick={() => handleSell(entry.id, entry.item.value || 5, entry.item.name)}
                  disabled={loading}
                  className="bg-zinc-800 hover:bg-green-900 text-green-400 px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1"
                >
                  Sell <span className="text-white">+{entry.item.value || 5}</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-auto pt-6 border-t border-zinc-800">
        {view === 'merchant' ? (
          <button onClick={() => setView('main')} className="flex items-center gap-2 text-zinc-500 hover:text-white mx-auto">
             <ArrowLeft size={16} /> Back to Outpost
          </button>
        ) : (
          <button onClick={onClose} className="flex items-center gap-2 text-zinc-500 hover:text-white mx-auto">
             <ArrowLeft size={16} /> Return to the Deep
          </button>
        )}
      </div>
    </div>
  );
}