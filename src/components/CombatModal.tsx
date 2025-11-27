'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import type { PlayerProfile, InventoryItem } from '@/types';
import { X, Sword, Shield, Zap } from 'lucide-react';
import { GiHearts, GiBroadsword, GiShield, GiHealthPotion } from 'react-icons/gi';
import { useAudio } from '@/hooks/useAudio';

interface Monster {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  gold_reward: number;
  xp_reward: number;
  is_boss?: boolean;
  special_effect?: string;
}

interface CombatModalProps {
  player: PlayerProfile;
  monster: Monster;
  onVictory: (finalHp: number) => void;
  onDefeat: () => void;
  inventory: InventoryItem[];
}

export default function CombatModal({ player, monster, onVictory, onDefeat, inventory }: CombatModalProps) {
  const { playSfx, playHover } = useAudio();
  const [bossHp, setBossHp] = useState(monster.hp);
  const [playerHp, setPlayerHp] = useState(player.health ?? player.vigor ?? player.max_health ?? player.max_stamina ?? 100);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [turn, setTurn] = useState<'player' | 'boss'>('player');
  const [nextBossMove, setNextBossMove] = useState<string | null>(null);
  const [isDefending, setIsDefending] = useState(false);
  const [artifactUsed, setArtifactUsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [lastBossHp, setLastBossHp] = useState(monster.hp);
  const bossTurnInProgress = useRef(false);

  // Calculate player stats from equipped gear
  const getPlayerStats = useCallback(() => {
    const equippedGear = inventory.filter(item => item.is_equipped);
    let bonusAtk = 0;
    let bonusDef = 0;
    
    equippedGear.forEach((entry) => {
      const stats = entry.stats_override || entry.item.stats || {};
      bonusAtk += stats.damage || 0;
      bonusDef += stats.defense || 0;
    });

    return {
      attack: (player.precision || 0) + bonusAtk,
      defense: bonusDef
    };
  }, [player, inventory]);

  // Check if player has counter artifact for this boss
  const hasCounterArtifact = useCallback(() => {
    if (!monster.special_effect) return false;
    
    return inventory.some(item => {
      const itemData = item.item;
      return (itemData.type === 'relic' || itemData.type === 'artifact') && 
             itemData.description?.toLowerCase().includes(monster.special_effect?.toLowerCase() || '');
    });
  }, [monster, inventory]);

  // Find consumable items
  const getConsumables = useCallback(() => {
    return inventory.filter(item => 
      item.item.type === 'consumable' && !item.is_equipped
    );
  }, [inventory]);

  const foodCount = getConsumables().length;

  const addLog = useCallback((message: string, isPlayerDamage: boolean = false) => {
    setCombatLog(prev => {
      const newLog = [message, ...prev].slice(0, 4);
      return newLog;
    });
  }, []);

  // Shake animation trigger
  useEffect(() => {
    if (bossHp < lastBossHp) {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
    }
    setLastBossHp(bossHp);
  }, [bossHp, lastBossHp]);

  // Player Attack
  const handleAttack = useCallback(async () => {
    if (turn !== 'player' || isProcessing) return;
    
    playSfx('hit'); // Attack sound
    setIsProcessing(true);
    const stats = getPlayerStats();
    const damage = Math.max(1, stats.attack - monster.defense);
    const newBossHp = Math.max(0, bossHp - damage);
    
    setBossHp(newBossHp);
    addLog(`> You hit for ${damage} dmg.`);
    
    if (newBossHp <= 0) {
      setTimeout(() => {
        addLog('> BOSS DEFEATED!');
        onVictory(playerHp);
      }, 1000);
      return;
    }
    
    setTurn('boss');
    setIsProcessing(false);
    
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, bossHp, getPlayerStats, addLog, onVictory, playerHp]);

  // Player Heal
  const handleHeal = useCallback(async () => {
    if (turn !== 'player' || isProcessing) return;
    
    const consumables = getConsumables();
    if (consumables.length === 0) {
      addLog('> No consumables available!');
      setIsProcessing(false);
      return;
    }
    
    setIsProcessing(true);
    
    const consumable = consumables[0];
    const stats = consumable.stats_override || consumable.item.stats || {};
    const healAmount = stats.heal || stats.vigor || 20;
    
    const maxHp = player.max_health ?? player.max_stamina ?? 100;
    const newPlayerHp = Math.min(maxHp, playerHp + healAmount);
    setPlayerHp(newPlayerHp);
    
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', consumable.id);
    
    if (!error) {
      addLog(`> You healed for ${healAmount} HP.`);
    }
    
    setTurn('boss');
    setIsProcessing(false);
    
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, playerHp, player, getConsumables, addLog]);

  // Player Defend
  const handleDefend = useCallback(() => {
    if (turn !== 'player' || isProcessing) return;
    
    setIsProcessing(true);
    setIsDefending(true);
    addLog('> You brace for impact.');
    
    setTurn('boss');
    setIsProcessing(false);
    
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, addLog]);

  // Player Artifact (Counter)
  const handleArtifact = useCallback(() => {
    if (turn !== 'player' || isProcessing || !hasCounterArtifact()) return;
    
    setIsProcessing(true);
    setArtifactUsed(true);
    addLog('> Counter artifact activated!');
    
    setTurn('boss');
    setIsProcessing(false);
    
    setTimeout(() => {
      handleBossTurn();
    }, 1500);
  }, [turn, isProcessing, hasCounterArtifact, addLog]);

  // Boss Turn
  const handleBossTurn = useCallback(() => {
    if (bossTurnInProgress.current) return;
    
    bossTurnInProgress.current = true;
    setIsProcessing(true);
    const stats = getPlayerStats();
    
    let attackType = 'normal';
    let damage = Math.max(1, monster.attack - stats.defense);
    
    // Check for special "Heavy" attack (telegraphed)
    if (monster.special_effect && Math.random() < 0.3) {
      attackType = 'heavy';
      damage = Math.max(1, Math.floor(monster.attack * 1.5) - stats.defense);
      setNextBossMove('Telegraph');
    } else {
      setNextBossMove(null);
    }
    
    // Check if artifact counters the attack
    if (attackType === 'heavy' && artifactUsed && monster.special_effect) {
      addLog(`> ${monster.name} charged, but artifact negated it!`);
      setArtifactUsed(false);
      setTurn('player');
      setIsProcessing(false);
      bossTurnInProgress.current = false;
      return;
    }
    
    const defending = isDefending;
    if (defending) {
      damage = Math.floor(damage / 2);
      setIsDefending(false);
    }
    
    setPlayerHp(prevHp => {
      const newPlayerHp = Math.max(0, prevHp - damage);
      
      // Play hit sound when player takes damage
      if (damage > 0) {
        playSfx('hit');
      }
      
      if (attackType === 'heavy') {
        addLog(`> ${monster.name} hit for ${damage} dmg!`, true);
      } else {
        addLog(`> ${monster.name} hit for ${damage} dmg.`, true);
      }
      
      if (newPlayerHp <= 0) {
        setTimeout(() => {
          addLog('> YOU HAVE FALLEN...');
          onDefeat();
        }, 1000);
        return newPlayerHp;
      }
      
      setTurn('player');
      setIsProcessing(false);
      bossTurnInProgress.current = false;
      return newPlayerHp;
    });
  }, [monster, getPlayerStats, isDefending, artifactUsed, addLog, onDefeat]);

  // Initialize combat log
  useEffect(() => {
    addLog(`> A ${monster.name} blocks your path!`);
    if (monster.special_effect) {
      addLog(`> Warning: Special abilities detected.`);
    }
  }, []);

  const maxPlayerHp = player.max_health ?? player.max_stamina ?? 100;
  const playerHpPercent = (playerHp / maxPlayerHp) * 100;
  const bossHpPercent = (bossHp / monster.hp) * 100;

  // Shake animation variant
  const shakeVariants = {
    shake: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.5 }
    },
    idle: {
      x: 0
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-zinc-900 border-2 border-red-900/50 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.2)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Boss Card */}
        <motion.div
          variants={shakeVariants}
          animate={shouldShake ? 'shake' : 'idle'}
          className="p-6 bg-gradient-to-b from-zinc-950 to-zinc-900 border-b-2 border-red-900/50"
        >
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold text-red-400 mb-2">{monster.name}</h2>
            
            {/* Intent Indicator */}
            <AnimatePresence>
              {nextBossMove === 'Telegraph' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [1, 0.5, 1], scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-yellow-400 font-bold text-lg mb-3"
                >
                  ⚠ CHARGING ATTACK ⚠
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Boss HP Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-red-400 font-bold">BOSS HP</span>
              <span className="text-red-400 font-mono">{bossHp} / {monster.hp}</span>
            </div>
            <div className="w-full h-10 bg-zinc-800 rounded-full overflow-hidden border-2 border-zinc-700 shadow-inner">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${bossHpPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-red-700 via-red-600 to-red-500"
              />
            </div>
          </div>
        </motion.div>

        {/* Battle Feed (Arena) */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/80 space-y-2 min-h-[120px] font-mono text-sm">
          <AnimatePresence mode="popLayout">
            {combatLog.length === 0 ? (
              <div className="text-zinc-500 text-center py-4">Combat begins...</div>
            ) : (
              combatLog.map((log, idx) => {
                const isPlayerDamage = log.includes('hit for') && !log.startsWith('> You');
                return (
                  <motion.div
                    key={`${log}-${idx}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`${isPlayerDamage ? 'text-red-400 animate-pulse' : 'text-zinc-300'}`}
                  >
                    {log}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Player HUD */}
        <div className="p-4 bg-zinc-900 border-t-2 border-zinc-800">
          {/* Player HP Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-emerald-400 font-bold">YOUR HP</span>
              <span className="text-emerald-400 font-mono">{playerHp} / {maxPlayerHp}</span>
            </div>
            <div className="w-full h-10 bg-zinc-800 rounded-full overflow-hidden border-2 border-zinc-700 shadow-inner">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${playerHpPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500"
              />
            </div>
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* ATTACK */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { playSfx('ui_click'); handleAttack(); }}
              onMouseEnter={() => playHover()}
              disabled={turn !== 'player' || isProcessing}
              className="bg-red-600/90 hover:bg-red-600 text-white p-4 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg border-2 border-red-700/50"
            >
              <Sword size={20} />
              ATTACK
            </motion.button>

            {/* DEFEND */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { playSfx('ui_click'); handleDefend(); }}
              onMouseEnter={() => playHover()}
              disabled={turn !== 'player' || isProcessing}
              className="bg-blue-600/90 hover:bg-blue-600 text-white p-4 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg border-2 border-blue-700/50"
            >
              <Shield size={20} />
              DEFEND
            </motion.button>

            {/* HEAL */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { playSfx('ui_click'); handleHeal(); }}
              onMouseEnter={() => playHover()}
              disabled={turn !== 'player' || isProcessing || foodCount === 0}
              className="bg-green-600/90 hover:bg-green-600 text-white p-4 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg border-2 border-green-700/50"
            >
              <GiHealthPotion size={20} />
              HEAL (x{foodCount})
            </motion.button>

            {/* SPECIAL */}
            {hasCounterArtifact() ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { playSfx('ui_click'); handleArtifact(); }}
                onMouseEnter={() => playHover()}
                disabled={turn !== 'player' || isProcessing || artifactUsed}
                className="bg-purple-600/90 hover:bg-purple-600 text-white p-4 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg border-2 border-purple-700/50"
              >
                <Zap size={20} />
                SPECIAL
              </motion.button>
            ) : (
              <div className="p-4 rounded-lg bg-zinc-800/50 border-2 border-zinc-700/50 flex items-center justify-center">
                <span className="text-zinc-500 text-xs">-</span>
              </div>
            )}
          </div>

          {/* Turn Indicator */}
          {turn === 'boss' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-center text-zinc-400 text-sm font-mono"
            >
              Boss is thinking...
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
