import { useState, useEffect, useCallback } from 'react';
import { X, Home, ArrowLeft, Coins, Trash2, Hammer, Swords, ArrowUp, Check } from 'lucide-react';
import { GiCampingTent, GiReceiveMoney, GiAnvilImpact, GiStrongbox, GiTrophyCup, GiElevator, GiScrollUnfurled } from 'react-icons/gi';
import type { PlayerProfile, InventoryItem } from '@/types';
import { supabase } from '@/lib/supabase';

interface TownProps {
  userId: string | null;
  player: PlayerProfile | null;
  onClose: () => void;
  onRest: (updates: Partial<PlayerProfile>) => void;
  onGoldUpgrade?: (stat: 'vigor' | 'precision' | 'aether') => void;
  onBankTransaction?: (amount: number) => void;
}

export default function Town({ userId, player, onClose, onRest, onGoldUpgrade, onBankTransaction }: TownProps) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'main' | 'merchant' | 'forge' | 'trainer' | 'leaderboard' | 'travel' | 'vault'>('main');
  const [sellItems, setSellItems] = useState<InventoryItem[]>([]);
  const [scrapCount, setScrapCount] = useState(0);
  const [message, setMessage] = useState('');
  const [leaderboard, setLeaderboard] = useState<PlayerProfile[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [ingredientCounts, setIngredientCounts] = useState<Record<string, Record<string, { have: number; need: number }>>>({});

  // Helper function to calculate training cost
  const getTrainingCost = (bought: number) => 100 * (bought + 1);

  // Helper function to calculate available checkpoints
  const getCheckpoints = (): number[] => {
    if (!player || !player.max_depth) return [];
    const checkpointCount = Math.floor(player.max_depth / 500);
    return Array.from({ length: checkpointCount }, (_, i) => (i + 1) * 500);
  };

  // Helper function to calculate travel cost
  const getTravelCost = (depth: number): number => {
    return Math.floor(depth * 0.5 + (depth * depth) / 10000);
  };

  // --- RECIPES ---
  const RECIPES = [
    { 
      name: 'Rat Skull Helm', 
      result_item: 'Rat Skull Helm', // Matches DB Name
      ingredients: [{ name: 'Rat Tail', count: 3 }, { name: 'Scrap Metal', count: 2 }],
      cost: 10 
    },
    { 
      name: 'Bone Shin Guards', 
      result_item: 'Bone Shin Guards', 
      ingredients: [{ name: 'Rat Bone', count: 3 }, { name: 'Scrap Metal', count: 2 }],
      cost: 10 
    }
  ];

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

  const loadLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, max_depth, level')
        .order('max_depth', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaderboard((data as unknown as PlayerProfile[]) || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setMessage('Failed to load leaderboard.');
    }
  };

  // Load ingredient counts for recipes
  const loadIngredientCounts = useCallback(async () => {
    if (!userId) return;
    
    const counts: Record<string, Record<string, { have: number; need: number }>> = {};
    
    for (const recipe of RECIPES) {
      const recipeCounts: Record<string, { have: number; need: number }> = {};
      
      for (const ingredient of recipe.ingredients) {
        const { data: items } = await supabase
          .from('inventory')
          .select('*, item:items(*)')
          .eq('user_id', userId);
        
        const count = items?.filter(i => i.item?.name === ingredient.name).length || 0;
        recipeCounts[ingredient.name] = { have: count, need: ingredient.count };
      }
      
      counts[recipe.name] = recipeCounts;
    }
    
    setIngredientCounts(counts);
  }, [userId]);

  useEffect(() => {
    if (view === 'merchant') loadSellableItems();
    if (view === 'forge') {
      loadScrapCount();
      loadIngredientCounts();
    }
    if (view === 'leaderboard') loadLeaderboard();
  }, [view, loadScrapCount, loadIngredientCounts, loadSellableItems, loadLeaderboard]);

  // Reset view to main when switching to campsite mode (to prevent accessing merchant/forge)
  useEffect(() => {
    if (!player) return;
    const isCampsite = player.depth > 0;
    if (isCampsite && (view === 'merchant' || view === 'forge')) {
      setView('main');
    }
  }, [player, view]);

  // Clear success message after a delay
  useEffect(() => {
    if (message && message.includes('✓')) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!player) return null;

  // Determine if we're in Campsite mode (depth > 0)
  const isCampsite = player.depth > 0;

  // --- ACTIONS ---

  const handleRest = async () => {
    if (!userId) return;

    if (player.gold < 10) {
      setMessage("You don't have enough gold!");
      return;
    }
    setLoading(true);
    try {
      const maxHealth = player.max_health ?? player.max_stamina ?? 100;
      const { error } = await supabase.from('profiles')
        .update({ gold: player.gold - 10, current_stamina: player.max_stamina, health: maxHealth, max_health: maxHealth })
        .eq('id', userId);

      if (error) throw error;
      setMessage("Restored HP & Stamina.");
      onRest({ gold: player.gold - 10, current_stamina: player.max_stamina, health: maxHealth, max_health: maxHealth });
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

  const handleRoughSleep = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // 30% chance of ambush
      const isAmbushed = Math.random() < 0.3;
      
      if (isAmbushed) {
        // Ambush: Take 10-20 damage and gain NO stamina
        const damage = Math.floor(Math.random() * 11) + 10; // 10-20 damage
        const currentHealth = player.health ?? player.vigor ?? player.max_health ?? player.max_stamina ?? 100;
        const maxHealth = player.max_health ?? player.max_stamina ?? 100;
        const newHealth = Math.max(0, currentHealth - damage);
        
        const { error } = await supabase.from('profiles')
          .update({ health: newHealth })
          .eq('id', userId);

        if (error) throw error;
        setMessage("Something attacked you in your sleep!");
        onRest({ health: newHealth });
      } else {
        // Safe sleep: +20 Stamina
        const newStamina = Math.min(player.max_stamina, (player.current_stamina || 0) + 20);
        
        const { error } = await supabase.from('profiles')
          .update({ current_stamina: newStamina })
          .eq('id', userId);

        if (error) throw error;
        setMessage("You rested uneasily. +20 Stamina.");
        onRest({ current_stamina: newStamina });
      }
    } catch (err) { 
      console.error(err); 
      setMessage("Failed to rest.");
    }
    finally { setLoading(false); }
  };

  const handleRename = async () => {
    if (!userId) return;

    const trimmedName = newName.trim();
    
    // Validation: 3-15 characters
    if (trimmedName.length < 3 || trimmedName.length > 15) {
      setMessage("Name must be between 3-15 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: trimmedName })
        .eq('id', userId);

      if (error) throw error;
      
      setMessage("✓ Name updated!");
      onRest({ username: trimmedName });
      setIsEditingName(false);
      setNewName('');
    } catch (err) {
      console.error(err);
      setMessage("Failed to update name.");
    } finally {
      setLoading(false);
    }
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
  const handleCraft = async (recipe: typeof RECIPES[0]) => {
    if (!userId) return;

    // Validation: Check gold
    if (player.gold < recipe.cost) {
      setMessage(`Not enough gold! Need ${recipe.cost} gold.`);
      return;
    }

    // Validation: Check ingredients
    const ingredientCounts: Record<string, number> = {};
    for (const ingredient of recipe.ingredients) {
      // Fetch all inventory items and join with items table
      const { data: items } = await supabase
        .from('inventory')
        .select('*, item:items(*)')
        .eq('user_id', userId);
      
      // Filter by name and count
      const count = items?.filter(i => i.item?.name === ingredient.name).length || 0;
      ingredientCounts[ingredient.name] = count;
      
      if (count < ingredient.count) {
        setMessage(`Not enough ${ingredient.name}! Need ${ingredient.count}, have ${count}.`);
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Deduct Gold
      const newGold = player.gold - recipe.cost;
      const { error: goldError } = await supabase
        .from('profiles')
        .update({ gold: newGold })
        .eq('id', userId);
      
      if (goldError) throw goldError;

      // 2. Delete required ingredients
      for (const ingredient of recipe.ingredients) {
        // Fetch items by name (join with items table)
        const { data: items } = await supabase
          .from('inventory')
          .select('id, item:items(*)')
          .eq('user_id', userId);
        
        if (!items) continue;
        
        // Filter by name and get IDs
        const matchingItems = items
          .filter((i: any) => i.item?.name === ingredient.name)
          .slice(0, ingredient.count)
          .map((i: any) => i.id);
        
        if (matchingItems.length < ingredient.count) {
          throw new Error(`Not enough ${ingredient.name} found during deletion.`);
        }
        
        // Delete the items
        const { error: delError } = await supabase
          .from('inventory')
          .delete()
          .in('id', matchingItems);
        
        if (delError) throw delError;
      }

      // 3. Find result item by name
      const { data: resultItem } = await supabase
        .from('items')
        .select('*')
        .eq('name', recipe.result_item)
        .single();

      if (!resultItem) {
        throw new Error(`Result item "${recipe.result_item}" not found in database.`);
      }

      // 4. Insert result item into inventory
      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          user_id: userId,
          item_id: resultItem.id,
          is_equipped: false,
          slot: resultItem.valid_slot
        });

      if (insertError) throw insertError;

      setMessage(`Crafted ${recipe.name}!`);
      onRest({ gold: newGold });
      
      // Reload scrap count if it changed
      if (recipe.ingredients.some(ing => ing.name === 'Scrap Metal')) {
        loadScrapCount();
      }

    } catch (err: unknown) {
      console.error(err);
      setMessage("Crafting failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleWarp = async (targetDepth: number) => {
    if (!userId) return;

    const baseCost = getTravelCost(targetDepth);
    const discount = Math.min(0.5, (player.aether || 0) * 0.01); // 1% per point, max 50%
    const cost = Math.floor(baseCost * (1 - discount));
    
    if (player.gold < cost) {
      setMessage("You don't have enough gold!");
      return;
    }

    setLoading(true);
    try {
      const newGold = player.gold - cost;
      const { error } = await supabase
        .from('profiles')
        .update({ depth: targetDepth, gold: newGold })
        .eq('id', userId);

      if (error) throw error;

      setMessage(`Warped to ${targetDepth}m depth.`);
      onRest({ depth: targetDepth, gold: newGold });
      onClose(); // Close Town after warping
    } catch (err) {
      console.error(err);
      setMessage("Failed to warp.");
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
    <div className="fixed inset-0 bg-zinc-950/95 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      
      {/* Scrollable content area */}
      <div 
        className="flex-1 overflow-y-auto px-6 pt-6 min-h-0" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3 flex-1">
            <Home className="text-yellow-500" size={24} />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-zinc-100">
                {isCampsite && view === 'main' ? 'Temporary Camp' : view === 'main' ? 'The Outpost' : view === 'merchant' ? 'Scrap Merchant' : view === 'forge' ? 'The Forge' : view === 'trainer' ? 'Combat Trainer' : view === 'travel' ? 'Abyssal Elevator' : view === 'vault' ? 'Iron Vault' : 'Hall of Records'}
              </h2>
              {view === 'main' && (
                <div className="flex items-center gap-2 mt-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename();
                          if (e.key === 'Escape') {
                            setIsEditingName(false);
                            setNewName('');
                          }
                        }}
                        placeholder={player.username || 'New Delver'}
                        className="bg-zinc-900 border border-zinc-700 text-zinc-100 px-2 py-1 rounded text-sm focus:outline-none focus:border-yellow-500 max-w-[150px]"
                        autoFocus
                        maxLength={15}
                      />
                      <button
                        onClick={handleRename}
                        disabled={loading}
                        className="p-1 hover:bg-zinc-800 rounded text-green-400 hover:text-green-300 disabled:opacity-50"
                        title="Save name"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          setNewName('');
                        }}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-300"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-400">
                        {player.username || 'New Delver'}
                      </span>
                      <button
                        onClick={() => {
                          setIsEditingName(true);
                          setNewName(player.username || '');
                        }}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Edit name"
                      >
                        <GiScrollUnfurled size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
          <div className="flex flex-col gap-4 pb-4">
          {/* CAMPSITE MODE (depth > 0) */}
          {isCampsite ? (
            <>
              <button
                onClick={handleRoughSleep}
                disabled={loading}
                className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group disabled:opacity-50"
              >
                <div className="bg-zinc-800 p-3 rounded text-blue-400 group-hover:text-blue-300">
                  <GiCampingTent size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Rough Sleep</h3>
                  <p className="text-zinc-500 text-sm">Free rest (+20 Stamina, 30% Ambush Risk)</p>
                </div>
                <span className="font-mono text-green-500 font-bold">FREE</span>
              </button>

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
            </>
          ) : (
            <>
              {/* TOWN MODE (depth == 0) */}
              <button
                onClick={handleRest}
                disabled={loading || player.gold < 10}
                className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group disabled:opacity-50"
              >
                <div className="bg-zinc-800 p-3 rounded text-blue-400 group-hover:text-blue-300">
                  <GiCampingTent size={24} />
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
                  <GiReceiveMoney size={24} />
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
                  <GiAnvilImpact size={24} />
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

              <button
                onClick={() => { setView('travel'); setMessage(''); }}
                className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group"
              >
                <div className="bg-zinc-800 p-3 rounded text-cyan-500 group-hover:text-cyan-400">
                  <GiElevator size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Abyssal Elevator</h3>
                  <p className="text-zinc-500 text-sm">Fast Travel to Checkpoints</p>
                </div>
              </button>

              <button
                onClick={() => { setView('vault'); setMessage(''); }}
                className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group"
              >
                <div className="bg-zinc-800 p-3 rounded text-amber-600 group-hover:text-amber-500">
                  <GiStrongbox size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Iron Vault</h3>
                  <p className="text-zinc-500 text-sm">Secure Gold Storage</p>
                </div>
              </button>

              <button
                onClick={() => { setView('leaderboard'); setMessage(''); }}
                className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-lg hover:border-zinc-600 transition-all text-left group"
              >
                <div className="bg-zinc-800 p-3 rounded text-yellow-500 group-hover:text-yellow-400">
                  <GiTrophyCup size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Hall of Records</h3>
                  <p className="text-zinc-500 text-sm">View Top Delvers</p>
                </div>
              </button>
            </>
          )}
        </div>
      )}

        {/* --- VIEW: MERCHANT --- (Only available at depth 0) */}
        {view === 'merchant' && !isCampsite && (
          <div className="flex flex-col gap-2 pb-4 pr-2">
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

        {/* --- VIEW: FORGE --- (Only available at depth 0) */}
        {view === 'forge' && !isCampsite && (
          <div className="flex flex-col gap-4 pb-4 pr-2">
          <div className="text-center space-y-2 mb-4">
            <GiAnvilImpact size={48} className="text-zinc-700 mx-auto" />
            <h3 className="text-xl font-bold text-zinc-300">Blacksmith&apos;s Forge</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto">
              Craft specific gear using recipes and materials.
            </p>
          </div>

          {RECIPES.map((recipe) => {
            const recipeCounts = ingredientCounts[recipe.name] || {};
            let canCraft = true;
            
            // Check if all ingredients are available
            for (const ingredient of recipe.ingredients) {
              const status = recipeCounts[ingredient.name] || { have: 0, need: ingredient.count };
              if (status.have < status.need) {
                canCraft = false;
                break;
              }
            }
            
            // Also check gold
            canCraft = canCraft && (player?.gold || 0) >= recipe.cost;

            return (
              <div key={recipe.name} className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-zinc-800 p-2 rounded">
                    <Hammer size={20} className="text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-zinc-200">{recipe.name}</h4>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {recipe.ingredients.map((ingredient) => {
                    const status = recipeCounts[ingredient.name] || { have: 0, need: ingredient.count };
                    const hasEnough = status.have >= status.need;
                    
                    return (
                      <div key={ingredient.name} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">{ingredient.name}</span>
                        <span className={hasEnough ? 'text-green-400' : 'text-red-400'}>
                          {status.have}/{status.need}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => handleCraft(recipe)}
                  disabled={loading || !canCraft}
                  className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 p-3 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Hammer size={18} />
                  Forge ({recipe.cost} G)
                </button>
              </div>
            );
          })}
        </div>
      )}

        {/* --- VIEW: TRAINER --- */}
        {view === 'trainer' && (
          <div className="flex flex-col gap-4 pb-4 pr-2">
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

        {/* --- VIEW: TRAVEL --- */}
        {view === 'travel' && !isCampsite && (
          <div className="flex flex-col gap-4 pb-4 pr-2">
            <div className="text-center space-y-2 mb-4">
              <GiElevator size={48} className="text-cyan-500 mx-auto" />
              <h3 className="text-xl font-bold text-zinc-300">Select Depth</h3>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                Fast travel to unlocked checkpoints.
              </p>
            </div>

            {getCheckpoints().length === 0 ? (
              <div className="text-zinc-500 text-center py-10">
                Reach 500m to unlock the elevator.
              </div>
            ) : (
              <div className="space-y-3">
                {getCheckpoints().map((checkpointDepth) => {
                  const baseCost = getTravelCost(checkpointDepth);
                  const discount = Math.min(0.5, (player.aether || 0) * 0.01); // 1% per point, max 50%
                  const cost = Math.floor(baseCost * (1 - discount));
                  const canAfford = player.gold >= cost;
                  const hasDiscount = discount > 0;
                  
                  return (
                    <div
                      key={checkpointDepth}
                      className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-1">
                          {checkpointDepth}m
                        </div>
                        <div className="text-lg font-bold flex items-center gap-2">
                          <Coins size={16} className="text-yellow-500" />
                          {hasDiscount ? (
                            <span className="flex items-center gap-2">
                              <span className="text-zinc-500 line-through">{baseCost}</span>
                              <span className="text-green-400">{cost} Gold</span>
                            </span>
                          ) : (
                            <span className="text-zinc-100">{cost} Gold</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleWarp(checkpointDepth)}
                        disabled={loading || !canAfford}
                        className={`px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-all ${
                          canAfford && !loading
                            ? 'bg-cyan-900/50 hover:bg-cyan-800 text-cyan-200 border border-cyan-700'
                            : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <GiElevator size={14} />
                        <span>WARP</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- VIEW: VAULT --- */}
        {view === 'vault' && !isCampsite && (
          <div className="flex flex-col gap-6 pb-4 pr-2">
            <div className="text-center space-y-2 mb-4">
              <GiStrongbox size={48} className="text-amber-600 mx-auto" />
              <h3 className="text-xl font-bold text-zinc-300">Iron Vault</h3>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                Secure your gold. Vault storage persists after death.
              </p>
            </div>

            {/* Balance Display */}
            <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Pocket</span>
                <span className="text-xl font-bold text-zinc-100 flex items-center gap-1">
                  {player.gold || 0} <Coins size={18} />
                </span>
              </div>
              <div className="h-px bg-zinc-800"></div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Vault</span>
                <span className="text-2xl font-black text-amber-500 flex items-center gap-1">
                  {player.bank_gold || 0} <Coins size={20} />
                </span>
              </div>
            </div>

            {/* Deposit Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Deposit</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={async () => {
                    if (!onBankTransaction || loading) return;
                    const amount = 100;
                    if ((player.gold || 0) < amount) {
                      setMessage("Not enough gold!");
                      return;
                    }
                    setLoading(true);
                    await onBankTransaction(amount);
                    setLoading(false);
                  }}
                  disabled={loading || (player.gold || 0) < 100}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    (player.gold || 0) >= 100 && !loading
                      ? 'bg-green-900/50 hover:bg-green-800 text-green-200 border border-green-700'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  100
                </button>
                <button
                  onClick={async () => {
                    if (!onBankTransaction || loading) return;
                    const amount = 1000;
                    if ((player.gold || 0) < amount) {
                      setMessage("Not enough gold!");
                      return;
                    }
                    setLoading(true);
                    await onBankTransaction(amount);
                    setLoading(false);
                  }}
                  disabled={loading || (player.gold || 0) < 1000}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    (player.gold || 0) >= 1000 && !loading
                      ? 'bg-green-900/50 hover:bg-green-800 text-green-200 border border-green-700'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  1000
                </button>
                <button
                  onClick={async () => {
                    if (!onBankTransaction || loading) return;
                    const amount = player.gold || 0;
                    if (amount <= 0) {
                      setMessage("No gold to deposit!");
                      return;
                    }
                    setLoading(true);
                    await onBankTransaction(amount);
                    setLoading(false);
                  }}
                  disabled={loading || (player.gold || 0) <= 0}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    (player.gold || 0) > 0 && !loading
                      ? 'bg-green-900/50 hover:bg-green-800 text-green-200 border border-green-700'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  ALL
                </button>
              </div>
            </div>

            {/* Withdraw Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Withdraw</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={async () => {
                    if (!onBankTransaction || loading) return;
                    const amount = -100;
                    if ((player.bank_gold || 0) < 100) {
                      setMessage("Not enough gold in vault!");
                      return;
                    }
                    setLoading(true);
                    await onBankTransaction(amount);
                    setLoading(false);
                  }}
                  disabled={loading || (player.bank_gold || 0) < 100}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    (player.bank_gold || 0) >= 100 && !loading
                      ? 'bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-700'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  100
                </button>
                <button
                  onClick={async () => {
                    if (!onBankTransaction || loading) return;
                    const amount = -1000;
                    if ((player.bank_gold || 0) < 1000) {
                      setMessage("Not enough gold in vault!");
                      return;
                    }
                    setLoading(true);
                    await onBankTransaction(amount);
                    setLoading(false);
                  }}
                  disabled={loading || (player.bank_gold || 0) < 1000}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    (player.bank_gold || 0) >= 1000 && !loading
                      ? 'bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-700'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  1000
                </button>
                <button
                  onClick={async () => {
                    if (!onBankTransaction || loading) return;
                    const amount = -(player.bank_gold || 0);
                    if (amount >= 0) {
                      setMessage("No gold in vault!");
                      return;
                    }
                    setLoading(true);
                    await onBankTransaction(amount);
                    setLoading(false);
                  }}
                  disabled={loading || (player.bank_gold || 0) <= 0}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    (player.bank_gold || 0) > 0 && !loading
                      ? 'bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-700'
                      : 'bg-zinc-800 text-zinc-600 border border-zinc-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  ALL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: LEADERBOARD --- */}
        {view === 'leaderboard' && (
          <div className="flex flex-col gap-4 pb-4 pr-2">
            <div className="text-center space-y-2 mb-4">
              <GiTrophyCup size={48} className="text-yellow-500 mx-auto" />
              <h3 className="text-xl font-bold text-zinc-300">Hall of Records</h3>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                The deepest delvers who have ventured into the abyss.
              </p>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-zinc-500 text-center py-10">Loading leaderboard...</div>
            ) : (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <div className="col-span-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">Rank</div>
                  <div className="col-span-5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Name</div>
                  <div className="col-span-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Record (m)</div>
                  <div className="col-span-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">Level</div>
                </div>
                {leaderboard.map((profile, index) => {
                  const rank = index + 1;
                  const isCurrentUser = userId && profile.id === userId;
                  const displayName = !profile.username || profile.username === 'New Delver' ? 'New Delver' : profile.username;

                  return (
                    <div
                      key={profile.id}
                      className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${
                        isCurrentUser
                          ? 'bg-yellow-900/20 border-yellow-600/50 text-yellow-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                      }`}
                    >
                      <div className={`col-span-2 font-bold text-lg ${
                        rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-zinc-400' : rank === 3 ? 'text-amber-600' : 'text-zinc-500'
                      }`}>
                        #{rank}
                      </div>
                      <div className="col-span-5 font-semibold truncate">{displayName}</div>
                      <div className="col-span-3 font-mono text-sm">{profile.max_depth || 0}m</div>
                      <div className="col-span-2 font-bold">{profile.level || 1}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Button container - fixed at bottom */}
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950 px-6 py-4 mt-auto">
        {view !== 'main' ? (
          <button 
            onClick={() => setView('main')} 
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-6 py-4 rounded-lg font-semibold transition-all active:scale-95"
          >
            <ArrowLeft size={20} /> Back
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




