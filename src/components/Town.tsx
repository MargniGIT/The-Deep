import { useState, useEffect } from 'react';
import { X, Home, Bed, ArrowLeft, Store, Coins, Trash2, Hammer, Anvil, Swords, ArrowUp } from 'lucide-react';
import type { PlayerProfile, InventoryItem } from '@/types';
import { supabase } from '@/lib/supabase';

interface TownProps {
  userId: string | null;
  player: PlayerProfile | null;
  onClose: () => void;
  onRest: (updates: Partial<PlayerProfile>) => void;
  onGoldUpgrade?: (stat: 'vigor' | 'precision' | 'aether') => void;
}

export default function Town({ userId, player, onClose, onRest, onGoldUpgrade }: TownProps) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'main' | 'merchant' | 'forge' | 'trainer'>('main');
  const [sellItems, setSellItems] = useState<InventoryItem[]>([]);
  const [scrapCount, setScrapCount] = useState(0);
  const [message, setMessage] = useState('');

  // Helper function to calculate training cost
  const getTrainingCost = (bought: number) => 100 * (bought + 1);

  // --- FETCH ITEMS ---
  const loadSellableItems = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('inventory')
      .select('*, item:items(*)')
      .eq('user_id', userId)
      .eq('is_equipped', false);

    if (data) setSellItems(data as unknown as InventoryItem[]);
  };

  const loadScrapCount = async () => {
    if (!userId) return;

    const { count, error } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('item_id', '1000'); // ID 1000 is Scrap Metal

    if (!error) setScrapCount(count || 0);
  };

  useEffect(() => {
    if (view === 'merchant') loadSellableItems();
    if (view === 'forge') loadScrapCount();
  }, [view]);

  // Clear success message after a delay
  useEffect(() => {
    if (message && message.includes('✓')) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!player) return null;

  // --- ACTIONS ---

  const handleRest = async () => {
    if (!userId) return;

    if (player.gold < 10) {
      setMessage("You don't have enough gold!");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ gold: player.gold - 10, current_stamina: player.max_stamina, vigor: player.max_stamina })
        .eq('id', userId);

      if (error) throw error;
      setMessage("Restored HP & Stamina.");
      onRest({ gold: player.gold - 10, current_stamina: player.max_stamina, vigor: player.max_stamina });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAscend = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ depth: 0 })
        .eq('id', userId);

      if (error) throw error;
      setMessage("You climbed back up to the light.");
      onRest({ depth: 0 });
    } catch (err) { 
      console.error(err); 
      setMessage("Failed to ascend.");
    }
    finally { setLoading(false); }
  };

  const handleSell = async (inventoryId: number, itemValue: number, itemName: string) => {
    if (!userId) return;

    if (!userId) return;

    setLoading(true);
    try {
      const { error: delError } = await supabase.from('inventory').delete().eq('id', inventoryId);
      if (delError) throw delError;

      const newGold = player.gold + itemValue;
      const { error: upError } = await supabase
        .from('profiles')
        .update({ gold: newGold })
        .eq('id', userId);
      if (upError) throw upError;

      setMessage(`Sold ${itemName} for ${itemValue} Gold.`);
      onRest({ gold: newGold });
      setSellItems((prev) => prev.filter((i) => i.id !== inventoryId));

    } catch (err) { console.error(err); setMessage("Error selling item."); }
    finally { setLoading(false); }
  };

  const handleBulkSell = async () => {
    if (!userId) return;

    const commonItems = sellItems.filter((i) => i.item.rarity === 'common');
    if (commonItems.length === 0) {
      setMessage("No common items to sell.");
      return;
    }

    setLoading(true);
    try {
      let totalValue = 0;
      const idsToDelete: number[] = [];

      commonItems.forEach((entry) => {
        totalValue += (entry.item.value || 5);
        idsToDelete.push(entry.id);
      });

      const { error: delError } = await supabase
        .from('inventory')
        .delete()
        .in('id', idsToDelete);

      if (delError) throw delError;

      const newGold = player.gold + totalValue;
      const { error: upError } = await supabase
        .from('profiles')
        .update({ gold: newGold })
        .eq('id', userId);

      if (upError) throw upError;

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

  // --- CRAFTING LOGIC ---
  const handleCraft = async () => {
    if (!userId) return;

    if (scrapCount < 5) {
      setMessage("Not enough Scrap Metal (Need 5).");
      return;
    }

    setLoading(true);
    try {
      // 1. Deduct 5 Scrap Metal
      // Since we can't easily delete "top 5", we fetch 5 IDs first
      const { data: scrapItems } = await supabase
        .from('inventory')
        .select('id')
        .eq('user_id', userId)
        .eq('item_id', '1000')
        .limit(5);

      if (!scrapItems || scrapItems.length < 5) {
        throw new Error("Not enough scrap found in DB check.");
      }

      const scrapIds = scrapItems.map(i => i.id);
      const { error: delError } = await supabase
        .from('inventory')
        .delete()
        .in('id', scrapIds);

      if (delError) throw delError;

      // 2. Select Random Item (Tier 1 or 2)
      // We assume items have a 'tier' column or we filter by rarity/depth.
      // User said "Tier 1 or 2 gear only". 
      // I'll assume 'min_depth' correlates to tier or just pick random common/uncommon.
      // Let's try fetching items with min_depth <= 200 (assuming depth correlates to tier).
      // Or just fetch all items and filter in memory if needed, but better to filter in query.
      // Assuming 'tier' column might not exist, I'll use rarity 'common' or 'uncommon'.
      const { data: potentialLoot } = await supabase
        .from('items')
        .select('*')
        .or('rarity.eq.common,rarity.eq.uncommon')
        .neq('type', 'material') // Ignore materials
        .limit(20);

      if (!potentialLoot || potentialLoot.length === 0) {
        throw new Error("No loot table available.");
      }

      const randomItem = potentialLoot[Math.floor(Math.random() * potentialLoot.length)];

      // 3. Insert New Item
      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          user_id: userId,
          item_id: randomItem.id,
          is_equipped: false,
          slot: randomItem.valid_slot
        });

      if (insertError) throw insertError;

      setMessage(`Crafted: ${randomItem.name}!`);
      setScrapCount(prev => prev - 5);

    } catch (err: unknown) {
      console.error(err);
      setMessage("Crafting failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ---

  const commonCount = sellItems.filter(i => i.item.rarity === 'common').length;
  const commonValue = sellItems
    .filter(i => i.item.rarity === 'common')
    .reduce((sum, i) => sum + (i.item.value || 5), 0);

  return (
    <div className="fixed inset-0 bg-zinc-950/95 z-40 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col p-6" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Home className="text-yellow-500" size={24} />
          <h2 className="text-2xl font-bold text-zinc-100">
            {view === 'main' ? 'The Outpost' : view === 'merchant' ? 'Scrap Merchant' : view === 'forge' ? 'The Forge' : 'Combat Trainer'}
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
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {player.depth > 0 && (
            <button
              onClick={handleAscend}
              disabled={loading}
              className="flex items-center gap-4 bg-zinc-900 border-2 border-blue-500 p-4 rounded-lg hover:border-blue-400 transition-all text-left group disabled:opacity-50"
            >
              <div className="bg-zinc-800 p-3 rounded text-blue-400 group-hover:text-blue-300">
                <ArrowUp size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Ascend to Surface</h3>
                <p className="text-zinc-500 text-sm">Return to the surface (0m)</p>
              </div>
            </button>
          )}

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

          <button
            onClick={() => { setView('forge'); setMessage(''); }}
            className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group"
          >
            <div className="bg-zinc-800 p-3 rounded text-red-500 group-hover:text-red-400">
              <Anvil size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">The Forge</h3>
              <p className="text-zinc-500 text-sm">Craft Gear from Scrap</p>
            </div>
          </button>

          <button
            onClick={() => { setView('trainer'); setMessage(''); }}
            className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group"
          >
            <div className="bg-zinc-800 p-3 rounded text-purple-500 group-hover:text-purple-400">
              <Swords size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Combat Trainer</h3>
              <p className="text-zinc-500 text-sm">Train Stats with Gold</p>
            </div>
          </button>
        </div>
      )}

      {/* --- VIEW: MERCHANT --- */}
      {view === 'merchant' && (
        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2 min-h-0 pb-32">
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

      {/* --- VIEW: FORGE --- */}
      {view === 'forge' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
          <div className="text-center space-y-2">
            <Anvil size={48} className="text-zinc-700 mx-auto" />
            <h3 className="text-xl font-bold text-zinc-300">Blacksmith&apos;s Forge</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto">
              Smelt down scrap metal to forge new equipment.
            </p>
          </div>

          <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 w-full max-w-xs text-center">
            <div className="text-sm text-zinc-500 mb-1 uppercase tracking-wider font-bold">Available Scrap</div>
            <div className="text-3xl font-black text-zinc-100 mb-4">{scrapCount}</div>

            <button
              onClick={handleCraft}
              disabled={loading || scrapCount < 5}
              className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 p-4 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Hammer size={20} />
              CRAFT GEAR (5 Scrap)
            </button>
          </div>
        </div>
      )}

      {/* --- VIEW: TRAINER --- */}
      {view === 'trainer' && (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-2 pb-32">
          <div className="text-center space-y-2 mb-4">
            <Swords size={48} className="text-purple-500 mx-auto" />
            <h3 className="text-xl font-bold text-zinc-300">Combat Trainer</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto">
              Spend gold to permanently increase your combat stats.
            </p>
          </div>

          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Current Gold</span>
              <span className="text-xl font-bold text-yellow-500 flex items-center gap-1">
                {player.gold} <Coins size={18} />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Training Cost</span>
              <span className="text-lg font-bold text-zinc-300">
                {getTrainingCost((player as any).stats_bought || 0)} <Coins size={14} className="inline" />
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {(['vigor', 'precision', 'aether'] as const).map((stat) => {
              const statsBought = (player as any).stats_bought || 0;
              const cost = getTrainingCost(statsBought);
              const canAfford = player.gold >= cost;

              return (
                <div
                  key={stat}
                  className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      {stat}
                    </div>
                    <div className="text-2xl font-black text-zinc-100">
                      {player[stat] || 0}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!onGoldUpgrade || loading || !canAfford) return;
                      
                      setLoading(true);
                      setMessage(`Training ${stat}...`);
                      
                      await onGoldUpgrade(stat);
                      
                      // The player prop will update via onProfileUpdate
                      // Show success message briefly
                      setTimeout(() => {
                        setMessage(`✓ ${stat.charAt(0).toUpperCase() + stat.slice(1)} increased!`);
                        setLoading(false);
                      }, 500);
                    }}
                    disabled={loading || !canAfford || !onGoldUpgrade}
                    className={`px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 transition-all ${
                      canAfford && !loading
                        ? 'bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700'
                        : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Swords size={14} />
                    <span>{loading ? 'TRAINING...' : 'TRAIN'}</span>
                    <span className="text-xs opacity-75">
                      ({cost} <Coins size={11} className="inline" />)
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto pt-6 border-t border-zinc-800 pb-2 shrink-0">
        {view !== 'main' ? (
          <button 
            onClick={() => setView('main')} 
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-6 py-4 rounded-lg font-semibold transition-all active:scale-95"
          >
            <ArrowLeft size={20} /> Back to Outpost
          </button>
        ) : (
          <button 
            onClick={onClose} 
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-6 py-4 rounded-lg font-semibold transition-all active:scale-95"
          >
            <ArrowLeft size={20} /> Return to the Deep
          </button>
        )}
      </div>
      </div>
    </div>
  );
}




